# Complete Refactoring Roadmap: Phases 3-8
## Northwest Custom Apparel Cap Embroidery Pricing System

### Table of Contents
1. [Overview](#overview)
2. [Phase 3: State Management & Data Flow](#phase-3-state-management--data-flow)
3. [Phase 4: Cap Embroidery Module Migration](#phase-4-cap-embroidery-module-migration)
4. [Phase 5: API Consolidation & Optimization](#phase-5-api-consolidation--optimization)
5. [Phase 6: UI/UX Redesign](#phase-6-uiux-redesign)
6. [Phase 7: Testing & Quality Assurance](#phase-7-testing--quality-assurance)
7. [Phase 8: Performance Optimization & Deployment](#phase-8-performance-optimization--deployment)
8. [Implementation Timeline](#implementation-timeline)
9. [Success Metrics](#success-metrics)

---

## Overview

This document provides a detailed implementation guide for completing the refactoring of the Northwest Custom Apparel pricing system. Each phase builds upon the previous ones, transforming the current 63-resource page into a modern, scalable application.

### Current State (After Phase 2)
- ✅ Modern build system with Webpack
- ✅ Core utility modules (EventBus, Logger, ApiClient, StorageManager)
- ✅ Reusable component library (PricingCalculator, QuoteSystem, ColorSelector, ImageGallery, PricingMatrix)
- ❌ 40+ legacy JavaScript files still in use
- ❌ No centralized state management
- ❌ Duplicate API calls and logic
- ❌ Inconsistent UI patterns

### Target State
- Single-page application with 3-4 optimized bundles
- < 2 second load time on 3G
- Reusable modules for all embellishment types
- Real-time quote synchronization
- Offline capability
- 95+ Lighthouse score

---

## Phase 3: State Management & Data Flow

### Branch: `refactor/state-management-phase3`

### Objective
Implement a centralized state management system that handles all data flow, eliminates prop drilling, and provides a single source of truth for the application.

### Implementation Details

#### 3.1 Create State Store

**File: `src/shared/state/store.js`**
```javascript
// Flux-inspired state management without external dependencies
export class Store {
  constructor(initialState = {}) {
    this.state = this.createReactiveState(initialState);
    this.reducers = {};
    this.middleware = [];
    this.subscribers = new Set();
    this.history = [];
    this.maxHistorySize = 50;
  }

  // Create reactive state with Proxy
  createReactiveState(obj) {
    return new Proxy(obj, {
      set: (target, property, value) => {
        const oldValue = target[property];
        target[property] = value;
        this.notifyChange({
          type: 'STATE_CHANGE',
          property,
          oldValue,
          newValue: value
        });
        return true;
      }
    });
  }

  // Register reducer functions
  registerReducer(name, reducer) {
    this.reducers[name] = reducer;
  }

  // Dispatch actions
  async dispatch(action) {
    // Run middleware
    for (const mw of this.middleware) {
      action = await mw(this, action);
      if (!action) return; // Middleware can cancel actions
    }

    // Save to history
    this.history.push({
      action,
      timestamp: Date.now(),
      previousState: JSON.parse(JSON.stringify(this.state))
    });

    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Apply reducers
    const newState = this.applyReducers(this.state, action);
    
    // Update state
    Object.assign(this.state, newState);
    
    // Notify subscribers
    this.notifySubscribers(action);
  }

  // Time travel debugging
  rewind(steps = 1) {
    if (this.history.length < steps) return;
    
    const targetIndex = this.history.length - steps - 1;
    const targetHistory = this.history[targetIndex];
    
    this.state = this.createReactiveState(targetHistory.previousState);
    this.history = this.history.slice(0, targetIndex + 1);
    
    this.notifySubscribers({
      type: 'TIME_TRAVEL',
      steps
    });
  }
}
```

**File: `src/shared/state/reducers/pricing-reducer.js`**
```javascript
export const pricingReducer = (state = {}, action) => {
  switch (action.type) {
    case 'PRICING_DATA_LOADED':
      return {
        ...state,
        pricing: {
          ...state.pricing,
          data: action.payload,
          loading: false,
          error: null
        }
      };
      
    case 'PRICING_CALCULATION_UPDATED':
      return {
        ...state,
        pricing: {
          ...state.pricing,
          currentCalculation: action.payload,
          history: [...(state.pricing.history || []), action.payload].slice(-10)
        }
      };
      
    case 'TIER_CHANGED':
      return {
        ...state,
        pricing: {
          ...state.pricing,
          activeTier: action.payload.tier,
          activeQuantity: action.payload.quantity
        }
      };
      
    default:
      return state;
  }
};
```

#### 3.2 Create Actions

**File: `src/shared/state/actions/pricing-actions.js`**
```javascript
// Action creators with validation
export const PricingActions = {
  loadPricingData: (styleNumber, color, embellishmentType) => ({
    type: 'LOAD_PRICING_DATA',
    payload: { styleNumber, color, embellishmentType },
    meta: {
      async: true,
      api: 'pricing'
    }
  }),
  
  updateCalculation: (calculation) => {
    // Validate calculation
    if (!calculation.quantity || !calculation.tier) {
      throw new Error('Invalid calculation data');
    }
    
    return {
      type: 'PRICING_CALCULATION_UPDATED',
      payload: calculation,
      meta: {
        timestamp: Date.now()
      }
    };
  },
  
  selectStitchCount: (stitchCount) => ({
    type: 'STITCH_COUNT_SELECTED',
    payload: { stitchCount },
    meta: {
      validate: (state) => {
        const validCounts = ['5000', '8000', '10000'];
        return validCounts.includes(stitchCount);
      }
    }
  })
};
```

#### 3.3 Create Middleware

**File: `src/shared/state/middleware/api-middleware.js`**
```javascript
export const apiMiddleware = (store) => async (action) => {
  if (!action.meta?.async) return action;
  
  const { api } = action.meta;
  
  // Dispatch loading state
  store.dispatch({
    type: `${action.type}_PENDING`,
    payload: action.payload
  });
  
  try {
    // Make API call
    const apiClient = store.getApiClient();
    const result = await apiClient[api](action.payload);
    
    // Dispatch success
    store.dispatch({
      type: `${action.type}_SUCCESS`,
      payload: result,
      meta: { request: action.payload }
    });
    
    return null; // Cancel original action
    
  } catch (error) {
    // Dispatch error
    store.dispatch({
      type: `${action.type}_ERROR`,
      payload: error,
      meta: { request: action.payload }
    });
    
    return null;
  }
};
```

**File: `src/shared/state/middleware/logger-middleware.js`**
```javascript
export const loggerMiddleware = (store) => (action) => {
  if (process.env.NODE_ENV === 'production') return action;
  
  console.group(`%c${action.type}`, 'color: #2e5827; font-weight: bold;');
  console.log('%cPrevious State:', 'color: #666;', store.getState());
  console.log('%cAction:', 'color: #0066cc;', action);
  
  // Let action process
  setTimeout(() => {
    console.log('%cNext State:', 'color: #228b22;', store.getState());
    console.groupEnd();
  }, 0);
  
  return action;
};
```

#### 3.4 Create Selectors

**File: `src/shared/state/selectors/pricing-selectors.js`**
```javascript
// Memoized selectors for performance
import { createMemoizer } from '../utils/memoize';

const memoize = createMemoizer();

export const PricingSelectors = {
  // Get current pricing data
  getPricingData: memoize((state) => state.pricing?.data),
  
  // Get price for specific size and quantity
  getPriceForSize: memoize((state, size, quantity) => {
    const pricing = state.pricing?.data;
    if (!pricing) return null;
    
    const tier = determineTier(quantity, pricing.tiers);
    return pricing.prices[size]?.[tier];
  }),
  
  // Get current calculation
  getCurrentCalculation: (state) => state.pricing?.currentCalculation,
  
  // Get savings information
  getSavingsInfo: memoize((state, quantity) => {
    const pricing = state.pricing?.data;
    if (!pricing || quantity < 24) return null;
    
    const currentTier = determineTier(quantity, pricing.tiers);
    const baseTier = determineTier(23, pricing.tiers);
    
    const currentPrice = getAveragePrice(pricing.prices, currentTier);
    const basePrice = getAveragePrice(pricing.prices, baseTier);
    
    return {
      savings: basePrice - currentPrice,
      percentage: ((basePrice - currentPrice) / basePrice) * 100,
      message: `Save ${((basePrice - currentPrice) / basePrice * 100).toFixed(0)}% on orders of ${quantity}+`
    };
  })
};
```

#### 3.5 Connect Components to Store

**File: `src/shared/state/connect.js`**
```javascript
// Higher-order function to connect components to store
export function connectToStore(Component, mapStateToProps, mapDispatchToProps) {
  return class ConnectedComponent extends Component {
    constructor(options) {
      super(options);
      this.store = options.store || window.__APP_STORE__;
      this.unsubscribe = null;
      this.mappedProps = {};
    }
    
    initialize() {
      // Subscribe to store changes
      this.unsubscribe = this.store.subscribe((action) => {
        this.updateMappedProps();
      });
      
      // Initial mapping
      this.updateMappedProps();
      
      // Call parent initialize
      super.initialize();
    }
    
    updateMappedProps() {
      const state = this.store.getState();
      
      // Map state to props
      if (mapStateToProps) {
        const stateProps = mapStateToProps(state, this);
        Object.assign(this.mappedProps, stateProps);
      }
      
      // Map dispatch to props
      if (mapDispatchToProps) {
        const dispatchProps = mapDispatchToProps(this.store.dispatch.bind(this.store), this);
        Object.assign(this.mappedProps, dispatchProps);
      }
      
      // Trigger re-render if component has render method
      if (this.render) {
        this.render();
      }
    }
    
    destroy() {
      if (this.unsubscribe) {
        this.unsubscribe();
      }
      super.destroy();
    }
  };
}
```

### Implementation Tasks

1. **Create Store Structure**
   ```bash
   src/shared/state/
   ├── store.js                 # Main store class
   ├── index.js                 # Exports and initialization
   ├── actions/
   │   ├── index.js
   │   ├── pricing-actions.js
   │   ├── quote-actions.js
   │   └── ui-actions.js
   ├── reducers/
   │   ├── index.js
   │   ├── pricing-reducer.js
   │   ├── quote-reducer.js
   │   └── ui-reducer.js
   ├── selectors/
   │   ├── index.js
   │   ├── pricing-selectors.js
   │   └── quote-selectors.js
   ├── middleware/
   │   ├── api-middleware.js
   │   ├── logger-middleware.js
   │   └── persistence-middleware.js
   └── utils/
       ├── memoize.js
       └── validators.js
   ```

2. **Update Components to Use Store**
   ```javascript
   // Example: PricingCalculator connected to store
   const ConnectedPricingCalculator = connectToStore(
     PricingCalculator,
     // mapStateToProps
     (state) => ({
       pricingData: PricingSelectors.getPricingData(state),
       currentTier: state.pricing.activeTier
     }),
     // mapDispatchToProps
     (dispatch) => ({
       updateCalculation: (calc) => dispatch(PricingActions.updateCalculation(calc))
     })
   );
   ```

3. **Implement DevTools**
   ```javascript
   // Chrome extension for state debugging
   if (window.__REDUX_DEVTOOLS_EXTENSION__) {
     store.connectDevTools();
   }
   ```

### Benefits
- Single source of truth for all application data
- Predictable state updates
- Time-travel debugging
- Easy testing with pure reducer functions
- Decoupled components
- Optimized re-renders with selectors

---

## Phase 4: Cap Embroidery Module Migration

### Branch: `refactor/cap-embroidery-modules-phase4`

### Objective
Migrate all cap embroidery specific functionality from legacy files to the new modular architecture, eliminating duplication and creating a clean, maintainable codebase.

### Implementation Details

#### 4.1 Module Structure

**File: `src/pages/cap-embroidery/modules/controller.js`**
```javascript
import { Logger } from '../../../shared/utils/logger';
import { connectToStore } from '../../../shared/state/connect';
import { PricingActions } from '../../../shared/state/actions/pricing-actions';

export class CapEmbroideryController {
  constructor(options = {}) {
    this.logger = new Logger('CapEmbController');
    this.store = options.store;
    this.components = new Map();
    
    // Configuration
    this.config = {
      defaultStitchCount: '8000',
      stitchCounts: ['5000', '8000', '10000'],
      backLogoEnabled: false,
      ...options.config
    };
  }
  
  async initialize() {
    this.logger.info('Initializing cap embroidery controller');
    
    // Initialize sub-modules
    await this.initializeModules();
    
    // Set up Caspio integration
    await this.setupCaspioIntegration();
    
    // Load initial data
    await this.loadInitialData();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  async initializeModules() {
    const modules = [
      { name: 'pricing', module: () => import('./pricing') },
      { name: 'quote', module: () => import('./quote') },
      { name: 'validation', module: () => import('./validation') },
      { name: 'backLogo', module: () => import('./back-logo-addon') }
    ];
    
    for (const { name, module } of modules) {
      try {
        const { default: ModuleClass } = await module();
        const instance = new ModuleClass({
          controller: this,
          store: this.store
        });
        
        await instance.initialize();
        this.components.set(name, instance);
        
      } catch (error) {
        this.logger.error(`Failed to initialize ${name} module:`, error);
      }
    }
  }
  
  async setupCaspioIntegration() {
    // Wait for Caspio iframe
    const iframe = await this.waitForElement('#caspio-pricing-iframe');
    
    // Listen for Caspio events
    window.addEventListener('message', this.handleCaspioMessage.bind(this));
    
    // Initialize Caspio communication
    this.sendCaspioMessage({
      type: 'INIT',
      config: {
        embellishmentType: 'cap-embroidery',
        stitchCounts: this.config.stitchCounts
      }
    });
  }
  
  handleCaspioMessage(event) {
    if (event.origin !== 'https://c7ect892.caspio.com') return;
    
    const { type, data } = event.data;
    
    switch (type) {
      case 'PRICING_DATA_READY':
        this.store.dispatch(PricingActions.loadPricingDataSuccess(data));
        break;
        
      case 'CALCULATION_COMPLETE':
        this.handleCalculationComplete(data);
        break;
    }
  }
}
```

#### 4.2 Pricing Module

**File: `src/pages/cap-embroidery/modules/pricing.js`**
```javascript
export default class CapEmbroideryPricing {
  constructor(options) {
    this.controller = options.controller;
    this.store = options.store;
    this.calculator = null;
    this.matrix = null;
  }
  
  async initialize() {
    // Create pricing calculator instance
    const { PricingCalculator } = await import('../../../shared/components/pricing-calculator');
    this.calculator = new PricingCalculator({
      embellishmentType: 'cap-embroidery',
      config: {
        ltmThreshold: 24,
        ltmFee: 50.00
      }
    });
    
    // Create pricing matrix display
    const { PricingMatrix } = await import('../../../shared/components/pricing-matrix');
    this.matrix = new PricingMatrix({
      container: '#pricing-matrix-container',
      highlightActiveTier: true
    });
    
    await this.matrix.initialize();
    
    // Subscribe to store changes
    this.store.subscribe(this.handleStoreChange.bind(this));
  }
  
  handleStoreChange(action) {
    switch (action.type) {
      case 'PRICING_DATA_LOADED_SUCCESS':
        this.updatePricingDisplay(action.payload);
        break;
        
      case 'QUANTITY_CHANGED':
        this.updateActiveTier(action.payload.quantity);
        break;
    }
  }
  
  updatePricingDisplay(pricingData) {
    // Update calculator
    this.calculator.setPricingData(pricingData);
    
    // Update matrix display
    this.matrix.setPricingData({
      headers: pricingData.headers,
      prices: pricingData.prices,
      tiers: pricingData.tiers
    });
  }
  
  calculate(options) {
    return this.calculator.calculate({
      ...options,
      cumulativePricing: true,
      additionalOptions: {
        backLogo: this.controller.config.backLogoEnabled
      }
    });
  }
}
```

#### 4.3 Quote Module

**File: `src/pages/cap-embroidery/modules/quote.js`**
```javascript
export default class CapEmbroideryQuote {
  constructor(options) {
    this.controller = options.controller;
    this.store = options.store;
    this.quoteSystem = null;
    this.apiClient = null;
  }
  
  async initialize() {
    // Import dependencies
    const [
      { QuoteSystem },
      { QuoteAPIClient }
    ] = await Promise.all([
      import('../../../shared/components/quote-system'),
      import('../../../shared/utils/quote-api-client')
    ]);
    
    // Create instances
    this.apiClient = new QuoteAPIClient();
    this.quoteSystem = new QuoteSystem({
      storage: this.store.storage,
      apiClient: this.apiClient,
      config: {
        embellishmentType: 'cap-embroidery',
        autoSave: true
      }
    });
    
    // Set up UI
    this.setupQuoteUI();
    
    // Load existing quote if available
    await this.checkForActiveQuote();
  }
  
  setupQuoteUI() {
    // Replace add to cart with quote builder
    const cartSection = document.getElementById('add-to-cart-section');
    if (cartSection) {
      cartSection.innerHTML = this.getQuoteBuilderHTML();
      this.bindQuoteEvents();
    }
  }
  
  getQuoteBuilderHTML() {
    return `
      <div class="quote-builder-container">
        <h3>Build Your Quote</h3>
        
        <div class="size-quantity-grid" id="size-quantity-grid">
          <!-- Populated dynamically -->
        </div>
        
        <div class="quote-options">
          <label class="checkbox-label">
            <input type="checkbox" id="rush-order-checkbox">
            <span>Rush Order (Ships in 3-5 days)</span>
          </label>
        </div>
        
        <button class="btn btn-primary btn-lg btn-block" id="add-to-quote-btn">
          Add to Quote
        </button>
        
        <div class="quote-summary" id="quote-summary-container">
          <!-- Quote summary renders here -->
        </div>
      </div>
    `;
  }
  
  async handleAddToQuote() {
    // Get form data
    const quantities = this.getSizeQuantities();
    const totalQuantity = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
    
    if (totalQuantity === 0) {
      this.showError('Please enter at least one quantity');
      return;
    }
    
    // Calculate pricing
    const pricing = this.controller.components.get('pricing').calculate({
      sizeBreakdown: quantities,
      quantity: totalQuantity
    });
    
    // Create quote item
    const item = {
      styleNumber: this.getProductInfo().styleNumber,
      productName: this.getProductInfo().productName,
      color: this.getSelectedColor(),
      quantity: totalQuantity,
      unitPrice: pricing.baseUnitPrice,
      sizeBreakdown: quantities,
      stitchCount: this.controller.config.currentStitchCount,
      hasBackLogo: this.controller.config.backLogoEnabled,
      metadata: {
        pricing: pricing,
        timestamp: Date.now()
      }
    };
    
    // Add to quote
    await this.quoteSystem.addItem(item);
    
    // Update UI
    this.updateQuoteSummary();
    this.resetForm();
  }
}
```

#### 4.4 Back Logo Add-on Module

**File: `src/pages/cap-embroidery/modules/back-logo-addon.js`**
```javascript
export default class BackLogoAddon {
  constructor(options) {
    this.controller = options.controller;
    this.store = options.store;
    this.enabled = false;
    this.stitchCount = 5000;
    this.basePrice = 5.00;
  }
  
  initialize() {
    this.setupUI();
    this.bindEvents();
  }
  
  setupUI() {
    const container = document.getElementById('back-logo-container');
    if (!container) return;
    
    container.innerHTML = `
      <div class="back-logo-addon ${this.enabled ? 'active' : ''}">
        <label class="checkbox-label">
          <input type="checkbox" id="back-logo-checkbox" ${this.enabled ? 'checked' : ''}>
          <span>Add Back Logo (+$${this.basePrice.toFixed(2)})</span>
        </label>
        
        <div class="back-logo-details" style="display: ${this.enabled ? 'block' : 'none'}">
          <div class="stitch-count-adjuster">
            <button class="btn-decrement" data-step="-1000">-</button>
            <span class="stitch-count-display">${this.stitchCount.toLocaleString()} stitches</span>
            <button class="btn-increment" data-step="1000">+</button>
          </div>
          <div class="price-display">
            Price: $<span id="back-logo-price">${this.calculatePrice().toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  bindEvents() {
    // Checkbox toggle
    const checkbox = document.getElementById('back-logo-checkbox');
    checkbox?.addEventListener('change', (e) => {
      this.enabled = e.target.checked;
      this.updateUI();
      this.notifyChange();
    });
    
    // Stitch count adjusters
    document.querySelectorAll('.back-logo-addon button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const step = parseInt(e.target.dataset.step);
        this.adjustStitchCount(step);
      });
    });
  }
  
  calculatePrice() {
    // Price tiers for back logo
    if (this.stitchCount <= 5000) return 5.00;
    if (this.stitchCount <= 8000) return 6.00;
    if (this.stitchCount <= 10000) return 7.00;
    return 8.00;
  }
  
  notifyChange() {
    this.store.dispatch({
      type: 'BACK_LOGO_CHANGED',
      payload: {
        enabled: this.enabled,
        stitchCount: this.stitchCount,
        price: this.calculatePrice()
      }
    });
  }
}
```

#### 4.5 Validation Module

**File: `src/pages/cap-embroidery/modules/validation.js`**
```javascript
export default class CapEmbroideryValidation {
  constructor(options) {
    this.controller = options.controller;
    this.store = options.store;
    
    this.rules = {
      minQuantity: 1,
      maxQuantity: 10000,
      validStitchCounts: ['5000', '8000', '10000'],
      maxBackLogoStitches: 10000,
      capProductKeywords: ['cap', 'hat', 'beanie', 'visor']
    };
  }
  
  initialize() {
    // Set up validation listeners
    this.store.subscribe(this.validateOnChange.bind(this));
  }
  
  validateOnChange(action) {
    switch (action.type) {
      case 'QUANTITY_CHANGED':
        this.validateQuantity(action.payload.quantity);
        break;
        
      case 'PRODUCT_SELECTED':
        this.validateProduct(action.payload.product);
        break;
    }
  }
  
  validateQuantity(quantity) {
    const errors = [];
    
    if (quantity < this.rules.minQuantity) {
      errors.push(`Minimum quantity is ${this.rules.minQuantity}`);
    }
    
    if (quantity > this.rules.maxQuantity) {
      errors.push(`Maximum quantity is ${this.rules.maxQuantity}`);
    }
    
    if (errors.length > 0) {
      this.store.dispatch({
        type: 'VALIDATION_ERROR',
        payload: { field: 'quantity', errors }
      });
      return false;
    }
    
    return true;
  }
  
  validateProduct(product) {
    const productName = product.name.toLowerCase();
    const isCapProduct = this.rules.capProductKeywords.some(keyword => 
      productName.includes(keyword)
    );
    
    if (!isCapProduct) {
      this.showProductWarning(product);
      return false;
    }
    
    return true;
  }
  
  async showProductWarning(product) {
    const modal = document.createElement('div');
    modal.className = 'validation-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Product Type Warning</h3>
        <p>"${product.name}" doesn't appear to be a cap product.</p>
        <p>Cap embroidery pricing is specifically for caps, hats, and beanies.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.validation-modal').remove()">
            Go Back
          </button>
          <button class="btn btn-primary" onclick="window.CapEmbroideryValidation.proceedAnyway()">
            Proceed Anyway
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
}
```

### Migration Tasks

1. **Identify Legacy Files to Replace**
   ```
   Files to migrate:
   - cap-embroidery-controller.js → controller.js
   - cap-embroidery-adapter.js → pricing.js
   - cap-embroidery-quote-adapter.js → quote.js
   - cap-embroidery-back-logo.js → back-logo-addon.js
   - cap-embroidery-validation.js → validation.js
   ```

2. **Create Migration Map**
   ```javascript
   // migration-map.js
   export const MIGRATION_MAP = {
     // Global functions to module methods
     'calculateCapEmbroideryPrice': 'pricing.calculate',
     'addToCapQuote': 'quote.handleAddToQuote',
     'validateCapProduct': 'validation.validateProduct',
     
     // DOM IDs that change
     'cap-pricing-grid': 'pricing-matrix-container',
     'cap-quote-summary': 'quote-summary-container'
   };
   ```

3. **Update HTML References**
   ```html
   <!-- Before -->
   <script src="shared_components/js/cap-embroidery-controller.js"></script>
   <script src="shared_components/js/cap-embroidery-adapter.js"></script>
   
   <!-- After -->
   <script src="dist/js/cap-embroidery.bundle.js"></script>
   ```

4. **Test Each Module**
   ```javascript
   // tests/cap-embroidery/controller.test.js
   describe('CapEmbroideryController', () => {
     test('initializes all modules', async () => {
       const controller = new CapEmbroideryController({ store });
       await controller.initialize();
       
       expect(controller.components.has('pricing')).toBe(true);
       expect(controller.components.has('quote')).toBe(true);
     });
   });
   ```

---

## Phase 5: API Consolidation & Optimization

### Branch: `refactor/api-consolidation-phase5`

### Objective
Unify all API calls into a single, efficient system with caching, request deduplication, and offline support.

### Implementation Details

#### 5.1 Unified API Client

**File: `src/shared/api/unified-client.js`**
```javascript
export class UnifiedAPIClient {
  constructor(config = {}) {
    this.config = {
      baseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
      timeout: 30000,
      retries: 3,
      cacheTime: 300000, // 5 minutes
      ...config
    };
    
    // Initialize subsystems
    this.cache = new CacheManager();
    this.queue = new RequestQueue();
    this.offline = new OfflineManager();
    this.metrics = new APIMetrics();
  }
  
  // Unified request method
  async request(endpoint, options = {}) {
    const requestId = this.generateRequestId(endpoint, options);
    
    // Check cache first
    if (options.cache !== false) {
      const cached = await this.cache.get(requestId);
      if (cached) {
        this.metrics.recordCacheHit(endpoint);
        return cached;
      }
    }
    
    // Check if request is already in flight
    const inFlight = this.queue.getInFlight(requestId);
    if (inFlight) {
      this.metrics.recordDedupe(endpoint);
      return inFlight;
    }
    
    // Check offline status
    if (!navigator.onLine && !options.allowOffline) {
      return this.offline.handleOfflineRequest(endpoint, options);
    }
    
    // Make request
    const request = this.makeRequest(endpoint, options);
    this.queue.addInFlight(requestId, request);
    
    try {
      const response = await request;
      
      // Cache successful responses
      if (options.cache !== false) {
        await this.cache.set(requestId, response, options.cacheTime);
      }
      
      // Record metrics
      this.metrics.recordSuccess(endpoint, response);
      
      return response;
      
    } catch (error) {
      this.metrics.recordError(endpoint, error);
      throw error;
      
    } finally {
      this.queue.removeInFlight(requestId);
    }
  }
}
```

#### 5.2 Caching Strategy

**File: `src/shared/api/cache-manager.js`**
```javascript
export class CacheManager {
  constructor() {
    this.memory = new Map();
    this.storage = new StorageCache();
    this.indexed = new IndexedDBCache();
  }
  
  async get(key) {
    // L1: Memory cache
    const memoryHit = this.memory.get(key);
    if (memoryHit && memoryHit.expires > Date.now()) {
      return memoryHit.data;
    }
    
    // L2: LocalStorage cache
    const storageHit = await this.storage.get(key);
    if (storageHit) {
      // Promote to memory
      this.memory.set(key, storageHit);
      return storageHit.data;
    }
    
    // L3: IndexedDB cache
    const indexedHit = await this.indexed.get(key);
    if (indexedHit) {
      // Promote to memory and storage
      this.memory.set(key, indexedHit);
      await this.storage.set(key, indexedHit);
      return indexedHit.data;
    }
    
    return null;
  }
  
  async set(key, data, ttl = 300000) {
    const cacheEntry = {
      data,
      expires: Date.now() + ttl,
      created: Date.now()
    };
    
    // Write to all cache levels
    this.memory.set(key, cacheEntry);
    await this.storage.set(key, cacheEntry);
    await this.indexed.set(key, cacheEntry);
    
    // Trim memory cache if too large
    if (this.memory.size > 100) {
      this.trimMemoryCache();
    }
  }
  
  trimMemoryCache() {
    const entries = Array.from(this.memory.entries());
    entries.sort((a, b) => a[1].created - b[1].created);
    
    // Remove oldest 25%
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.memory.delete(entries[i][0]);
    }
  }
}
```

#### 5.3 Request Queue

**File: `src/shared/api/request-queue.js`**
```javascript
export class RequestQueue {
  constructor(config = {}) {
    this.config = {
      maxConcurrent: 6,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.pending = [];
    this.inFlight = new Map();
    this.processing = false;
  }
  
  async add(request) {
    return new Promise((resolve, reject) => {
      this.pending.push({
        request,
        resolve,
        reject,
        retries: 0
      });
      
      this.process();
    });
  }
  
  async process() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.pending.length > 0 && this.inFlight.size < this.config.maxConcurrent) {
      const item = this.pending.shift();
      this.executeRequest(item);
    }
    
    this.processing = false;
  }
  
  async executeRequest(item) {
    const { request, resolve, reject, retries } = item;
    
    try {
      const requestId = request.id || Date.now();
      this.inFlight.set(requestId, request);
      
      const result = await request.execute();
      
      this.inFlight.delete(requestId);
      resolve(result);
      
      // Process next request
      this.process();
      
    } catch (error) {
      this.inFlight.delete(request.id);
      
      if (retries < this.config.maxRetries) {
        // Retry with exponential backoff
        setTimeout(() => {
          item.retries++;
          this.pending.unshift(item);
          this.process();
        }, this.config.retryDelay * Math.pow(2, retries));
      } else {
        reject(error);
        this.process();
      }
    }
  }
}
```

#### 5.4 Offline Support

**File: `src/shared/api/offline-manager.js`**
```javascript
export class OfflineManager {
  constructor() {
    this.syncQueue = [];
    this.db = new OfflineDatabase();
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.sync());
    window.addEventListener('offline', () => this.notifyOffline());
  }
  
  async handleOfflineRequest(endpoint, options) {
    // Check if we have offline data
    const offlineData = await this.db.get(endpoint, options);
    
    if (offlineData) {
      return {
        ...offlineData,
        _offline: true,
        _cachedAt: offlineData.timestamp
      };
    }
    
    // Queue for sync if it's a write operation
    if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
      await this.queueForSync(endpoint, options);
      return {
        _offline: true,
        _queued: true,
        _queueId: Date.now()
      };
    }
    
    throw new Error('No offline data available');
  }
  
  async queueForSync(endpoint, options) {
    const syncItem = {
      id: Date.now(),
      endpoint,
      options,
      timestamp: Date.now(),
      attempts: 0
    };
    
    this.syncQueue.push(syncItem);
    await this.db.saveSyncQueue(this.syncQueue);
    
    this.notifyQueued(syncItem);
  }
  
  async sync() {
    if (this.syncQueue.length === 0) return;
    
    this.notifySync('start');
    
    const completed = [];
    const failed = [];
    
    for (const item of this.syncQueue) {
      try {
        await this.syncItem(item);
        completed.push(item);
      } catch (error) {
        item.attempts++;
        if (item.attempts >= 3) {
          failed.push(item);
        }
      }
    }
    
    // Update queue
    this.syncQueue = this.syncQueue.filter(
      item => !completed.includes(item) && !failed.includes(item)
    );
    
    await this.db.saveSyncQueue(this.syncQueue);
    
    this.notifySync('complete', { completed, failed });
  }
}
```

#### 5.5 API Endpoints Configuration

**File: `src/shared/api/endpoints.js`**
```javascript
export const API_ENDPOINTS = {
  // Pricing endpoints
  pricing: {
    matrix: {
      path: '/pricing-matrix',
      method: 'GET',
      cache: true,
      cacheTime: 3600000, // 1 hour
      params: ['styleNumber', 'color', 'embellishmentType']
    },
    calculate: {
      path: '/pricing/calculate',
      method: 'POST',
      cache: true,
      cacheTime: 300000, // 5 minutes
      body: ['styleNumber', 'quantities', 'options']
    }
  },
  
  // Quote endpoints
  quotes: {
    create: {
      path: '/quote_sessions',
      method: 'POST',
      cache: false,
      body: ['customer', 'items', 'metadata']
    },
    get: {
      path: '/quote_sessions/:id',
      method: 'GET',
      cache: true,
      cacheTime: 60000 // 1 minute
    },
    update: {
      path: '/quote_sessions/:id',
      method: 'PUT',
      cache: false
    },
    items: {
      add: {
        path: '/quote_items',
        method: 'POST',
        cache: false
      },
      remove: {
        path: '/quote_items/:id',
        method: 'DELETE',
        cache: false
      }
    }
  },
  
  // Product endpoints
  products: {
    search: {
      path: '/products/search',
      method: 'GET',
      cache: true,
      cacheTime: 3600000,
      params: ['query', 'category', 'limit']
    },
    details: {
      path: '/products/:styleNumber',
      method: 'GET',
      cache: true,
      cacheTime: 3600000
    },
    inventory: {
      path: '/products/:styleNumber/inventory',
      method: 'GET',
      cache: true,
      cacheTime: 300000 // 5 minutes
    }
  }
};
```

#### 5.6 API Metrics & Monitoring

**File: `src/shared/api/metrics.js`**
```javascript
export class APIMetrics {
  constructor() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
      dedupes: 0,
      avgResponseTime: 0
    };
    
    // Performance observer
    if ('PerformanceObserver' in window) {
      this.setupPerformanceObserver();
    }
  }
  
  recordRequest(endpoint, duration, status) {
    if (!this.metrics.requests.has(endpoint)) {
      this.metrics.requests.set(endpoint, {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        success: 0,
        errors: 0
      });
    }
    
    const stats = this.metrics.requests.get(endpoint);
    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    
    if (status >= 200 && status < 300) {
      stats.success++;
    } else {
      stats.errors++;
    }
    
    // Update global average
    this.updateGlobalMetrics();
  }
  
  getReport() {
    const report = {
      summary: {
        totalRequests: Array.from(this.metrics.requests.values())
          .reduce((sum, stat) => sum + stat.count, 0),
        cacheHitRate: this.metrics.cacheHits / 
          (this.metrics.cacheHits + this.metrics.cacheMisses),
        dedupeRate: this.metrics.dedupes / 
          Array.from(this.metrics.requests.values())
            .reduce((sum, stat) => sum + stat.count, 0),
        avgResponseTime: this.metrics.avgResponseTime
      },
      endpoints: {}
    };
    
    // Add endpoint details
    for (const [endpoint, stats] of this.metrics.requests) {
      report.endpoints[endpoint] = {
        ...stats,
        errorRate: stats.errors / stats.count
      };
    }
    
    return report;
  }
  
  // Send metrics to analytics
  async sendMetrics() {
    const report = this.getReport();
    
    // Send to analytics service
    if (window.ga) {
      window.ga('send', 'event', 'API', 'performance', JSON.stringify(report));
    }
    
    // Log to console in dev
    if (process.env.NODE_ENV === 'development') {
      console.table(report.endpoints);
    }
  }
}
```

### Implementation Tasks

1. **Replace Existing API Calls**
   ```javascript
   // Before
   fetch('/api/pricing-matrix', { method: 'POST', body: JSON.stringify(data) })
     .then(res => res.json())
     .then(data => { /* handle */ });
   
   // After
   const api = new UnifiedAPIClient();
   const data = await api.request('pricing.matrix', {
     params: { styleNumber, color, embellishmentType }
   });
   ```

2. **Set Up Service Worker**
   ```javascript
   // service-worker.js
   self.addEventListener('fetch', event => {
     if (event.request.url.includes('/api/')) {
       event.respondWith(
         caches.match(event.request)
           .then(response => response || fetch(event.request))
       );
     }
   });
   ```

3. **Configure Caching Rules**
   ```javascript
   // cache-config.js
   export const CACHE_CONFIG = {
     'pricing-matrix': {
       strategy: 'cache-first',
       maxAge: 3600000,
       maxEntries: 100
     },
     'quote-sessions': {
       strategy: 'network-first',
       maxAge: 60000
     }
   };
   ```

---

## Phase 6: UI/UX Redesign

### Branch: `refactor/ui-redesign-phase6`

### Objective
Create a modern, responsive, and accessible user interface that provides an exceptional user experience across all devices.

### Implementation Details

#### 6.1 Design System

**File: `src/shared/design-system/tokens.js`**
```javascript
export const DESIGN_TOKENS = {
  colors: {
    primary: {
      50: '#f0f5ef',
      100: '#d9e6d6',
      200: '#b3ccad',
      300: '#8cb384',
      400: '#66995b',
      500: '#2e5827', // Main brand color
      600: '#264a20',
      700: '#1e3b19',
      800: '#162d13',
      900: '#0e1e0c'
    },
    secondary: {
      50: '#fff9f0',
      100: '#ffeed1',
      200: '#ffdda3',
      300: '#ffcc75',
      400: '#ffbb47',
      500: '#663c00', // Secondary brand color
      600: '#523000',
      700: '#3d2400',
      800: '#291800',
      900: '#140c00'
    },
    semantic: {
      success: '#28a745',
      warning: '#ffc107',
      danger: '#dc3545',
      info: '#17a2b8'
    },
    neutral: {
      0: '#ffffff',
      50: '#f8f9fa',
      100: '#e9ecef',
      200: '#dee2e6',
      300: '#ced4da',
      400: '#adb5bd',
      500: '#6c757d',
      600: '#495057',
      700: '#343a40',
      800: '#212529',
      900: '#000000'
    }
  },
  
  typography: {
    fontFamily: {
      base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      heading: '"Montserrat", sans-serif',
      mono: '"Fira Code", monospace'
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem'     // 48px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2
    }
  },
  
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
    24: '6rem'     // 96px
  },
  
  breakpoints: {
    xs: '0',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1400px'
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
  },
  
  animation: {
    duration: {
      fast: '150ms',
      base: '300ms',
      slow: '500ms',
      slower: '1000ms'
    },
    easing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }
};
```

#### 6.2 Component Library

**File: `src/shared/ui/components/Button.js`**
```javascript
export class Button {
  constructor(options = {}) {
    this.options = {
      variant: 'primary', // primary, secondary, outline, ghost
      size: 'md', // sm, md, lg
      fullWidth: false,
      loading: false,
      disabled: false,
      icon: null,
      iconPosition: 'left',
      ...options
    };
  }
  
  render() {
    const classes = [
      'btn',
      `btn-${this.options.variant}`,
      `btn-${this.options.size}`,
      this.options.fullWidth && 'btn-full',
      this.options.loading && 'btn-loading',
      this.options.disabled && 'btn-disabled'
    ].filter(Boolean).join(' ');
    
    return `
      <button 
        class="${classes}"
        ${this.options.disabled ? 'disabled' : ''}
        ${this.options.onClick ? `onclick="${this.options.onClick}"` : ''}
      >
        ${this.options.loading ? this.renderSpinner() : ''}
        ${this.options.icon && this.options.iconPosition === 'left' ? this.renderIcon() : ''}
        <span class="btn-text">${this.options.text}</span>
        ${this.options.icon && this.options.iconPosition === 'right' ? this.renderIcon() : ''}
      </button>
    `;
  }
  
  renderSpinner() {
    return '<span class="btn-spinner"></span>';
  }
  
  renderIcon() {
    return `<span class="btn-icon">${this.options.icon}</span>`;
  }
}
```

**File: `src/shared/ui/components/Card.js`**
```javascript
export class Card {
  constructor(options = {}) {
    this.options = {
      variant: 'default', // default, bordered, elevated
      padding: 'md',
      ...options
    };
  }
  
  render() {
    return `
      <div class="card card-${this.options.variant} p-${this.options.padding}">
        ${this.options.header ? this.renderHeader() : ''}
        <div class="card-body">
          ${this.options.content || ''}
        </div>
        ${this.options.footer ? this.renderFooter() : ''}
      </div>
    `;
  }
  
  renderHeader() {
    return `
      <div class="card-header">
        ${this.options.header.title ? `<h3 class="card-title">${this.options.header.title}</h3>` : ''}
        ${this.options.header.subtitle ? `<p class="card-subtitle">${this.options.header.subtitle}</p>` : ''}
        ${this.options.header.actions ? `<div class="card-actions">${this.options.header.actions}</div>` : ''}
      </div>
    `;
  }
}
```

#### 6.3 Layout System

**File: `src/shared/ui/layouts/PricingPageLayout.js`**
```javascript
export class PricingPageLayout {
  constructor(options = {}) {
    this.options = {
      sidebar: true,
      sidebarPosition: 'right',
      stickyHeader: true,
      ...options
    };
  }
  
  render() {
    return `
      <div class="pricing-layout ${this.options.sidebar ? 'has-sidebar' : ''}">
        ${this.renderHeader()}
        
        <div class="pricing-layout-body">
          ${this.options.sidebar && this.options.sidebarPosition === 'left' ? this.renderSidebar() : ''}
          
          <main class="pricing-main">
            ${this.renderBreadcrumbs()}
            ${this.renderProductContext()}
            ${this.renderPricingContent()}
          </main>
          
          ${this.options.sidebar && this.options.sidebarPosition === 'right' ? this.renderSidebar() : ''}
        </div>
        
        ${this.renderMobileQuoteBar()}
      </div>
    `;
  }
  
  renderHeader() {
    return `
      <header class="pricing-header ${this.options.stickyHeader ? 'sticky' : ''}">
        <div class="container">
          <div class="header-content">
            <div class="header-logo">
              <img src="/assets/logo.svg" alt="Northwest Custom Apparel">
            </div>
            
            <nav class="header-nav">
              <a href="/" class="nav-link">Products</a>
              <a href="/pricing" class="nav-link active">Pricing</a>
              <a href="/about" class="nav-link">About</a>
              <a href="/contact" class="nav-link">Contact</a>
            </nav>
            
            <div class="header-actions">
              <button class="btn-icon" aria-label="Search">
                <svg><!-- Search icon --></svg>
              </button>
              
              <div class="quote-indicator">
                <span class="quote-count">3</span>
                <svg><!-- Quote icon --></svg>
              </div>
            </div>
          </div>
        </div>
      </header>
    `;
  }
  
  renderProductContext() {
    return `
      <div class="product-context-bar">
        <div class="product-image">
          <img src="/products/cap-123.jpg" alt="Product">
        </div>
        
        <div class="product-info">
          <h2 class="product-name">Richardson 112 Trucker Cap</h2>
          <div class="product-meta">
            <span class="product-style">Style: 112</span>
            <span class="product-color">Color: Black/White</span>
          </div>
        </div>
        
        <div class="product-actions">
          <button class="btn btn-outline btn-sm">Change Product</button>
          <button class="btn btn-outline btn-sm">View Details</button>
        </div>
      </div>
    `;
  }
  
  renderPricingContent() {
    return `
      <div class="pricing-content">
        <!-- Stitch count selector -->
        <section class="pricing-section">
          <h3 class="section-title">Select Stitch Count</h3>
          <div class="stitch-selector">
            <!-- Stitch count options -->
          </div>
        </section>
        
        <!-- Pricing matrix -->
        <section class="pricing-section">
          <h3 class="section-title">Pricing</h3>
          <div id="pricing-matrix-container">
            <!-- Pricing matrix renders here -->
          </div>
        </section>
        
        <!-- Add-ons -->
        <section class="pricing-section">
          <h3 class="section-title">Add-ons</h3>
          <div class="addons-list">
            <!-- Add-on options -->
          </div>
        </section>
        
        <!-- Size quantity builder -->
        <section class="pricing-section">
          <h3 class="section-title">Enter Quantities</h3>
          <div id="size-quantity-builder">
            <!-- Size quantity inputs -->
          </div>
        </section>
      </div>
    `;
  }
  
  renderSidebar() {
    return `
      <aside class="pricing-sidebar">
        <div class="sidebar-sticky">
          <!-- Quote summary -->
          <div class="quote-summary-card">
            <h3>Quote Summary</h3>
            <div id="quote-summary">
              <!-- Quote items render here -->
            </div>
          </div>
          
          <!-- Quick actions -->
          <div class="quick-actions">
            <button class="btn btn-primary btn-full">Save Quote</button>
            <button class="btn btn-secondary btn-full">Email Quote</button>
          </div>
          
          <!-- Help section -->
          <div class="help-card">
            <h4>Need Help?</h4>
            <p>Our experts are here to help</p>
            <button class="btn btn-outline btn-sm">Chat Now</button>
          </div>
        </div>
      </aside>
    `;
  }
  
  renderMobileQuoteBar() {
    return `
      <div class="mobile-quote-bar">
        <div class="quote-summary-mini">
          <span class="quote-items">3 items</span>
          <span class="quote-total">$1,250.00</span>
        </div>
        <button class="btn btn-primary btn-sm">View Quote</button>
      </div>
    `;
  }
}
```

#### 6.4 Responsive Design

**File: `src/shared/ui/styles/responsive.css`**
```css
/* Mobile-first responsive design */

/* Base styles (mobile) */
.pricing-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.pricing-main {
  padding: var(--spacing-4);
}

.pricing-sidebar {
  display: none;
}

.mobile-quote-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid var(--neutral-200);
  padding: var(--spacing-3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .pricing-main {
    padding: var(--spacing-6);
  }
  
  .product-context-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
  }
  
  .stitch-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-4);
  }
}

/* Desktop (992px+) */
@media (min-width: 992px) {
  .pricing-layout-body {
    display: grid;
    grid-template-columns: 1fr 350px;
    gap: var(--spacing-6);
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .pricing-sidebar {
    display: block;
  }
  
  .mobile-quote-bar {
    display: none;
  }
  
  .sidebar-sticky {
    position: sticky;
    top: calc(var(--header-height) + var(--spacing-4));
  }
}

/* Large desktop (1400px+) */
@media (min-width: 1400px) {
  .pricing-layout-body {
    grid-template-columns: 1fr 400px;
  }
  
  .pricing-content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-6);
  }
  
  .pricing-section:first-child,
  .pricing-section:nth-child(2) {
    grid-column: span 2;
  }
}

/* Print styles */
@media print {
  .pricing-header,
  .pricing-sidebar,
  .mobile-quote-bar,
  .no-print {
    display: none !important;
  }
  
  .pricing-layout-body {
    display: block !important;
  }
  
  .pricing-main {
    max-width: none !important;
    padding: 0 !important;
  }
}
```

#### 6.5 Accessibility

**File: `src/shared/ui/accessibility/focus-management.js`**
```javascript
export class FocusManager {
  constructor() {
    this.focusableElements = 'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select';
    this.currentFocus = null;
    this.focusTrap = null;
  }
  
  // Trap focus within an element (for modals)
  trapFocus(element) {
    const focusable = element.querySelectorAll(this.focusableElements);
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    
    this.focusTrap = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
      
      if (e.key === 'Escape') {
        this.releaseFocus();
      }
    };
    
    element.addEventListener('keydown', this.focusTrap);
    firstFocusable.focus();
  }
  
  // Release focus trap
  releaseFocus() {
    if (this.focusTrap) {
      document.removeEventListener('keydown', this.focusTrap);
      this.focusTrap = null;
    }
    
    if (this.currentFocus) {
      this.currentFocus.focus();
    }
  }
  
  // Skip links for keyboard navigation
  setupSkipLinks() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  }
  
  // Announce dynamic content changes
  announce(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
}
```

**File: `src/shared/ui/accessibility/aria-helpers.js`**
```javascript
export class AriaHelpers {
  // Set up ARIA labels for pricing matrix
  static setupPricingMatrix(table) {
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', 'Pricing by quantity and size');
    
    // Label headers
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
      header.id = `header-${index}`;
      header.setAttribute('scope', index === 0 ? 'row' : 'col');
    });
    
    // Associate cells with headers
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      cells.forEach((cell, index) => {
        const headerId = `header-${index + 1}`;
        cell.setAttribute('headers', headerId);
      });
    });
  }
  
  // Loading states
  static setLoading(element, isLoading) {
    if (isLoading) {
      element.setAttribute('aria-busy', 'true');
      element.setAttribute('aria-label', 'Loading content');
    } else {
      element.removeAttribute('aria-busy');
      element.removeAttribute('aria-label');
    }
  }
  
  // Error states
  static setError(input, errorMessage) {
    const errorId = `error-${input.id}`;
    
    // Create or update error message
    let errorElement = document.getElementById(errorId);
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = errorId;
      errorElement.className = 'error-message';
      input.parentNode.appendChild(errorElement);
    }
    
    errorElement.textContent = errorMessage;
    
    // Update input ARIA
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errorId);
  }
}
```

#### 6.6 Animation System

**File: `src/shared/ui/animations/transitions.js`**
```javascript
export class Transitions {
  static fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    const animation = element.animate([
      { opacity: 0 },
      { opacity: 1 }
    ], {
      duration,
      easing: 'ease-out',
      fill: 'forwards'
    });
    
    return animation.finished;
  }
  
  static slideIn(element, direction = 'left', duration = 300) {
    const transforms = {
      left: 'translateX(-100%)',
      right: 'translateX(100%)',
      top: 'translateY(-100%)',
      bottom: 'translateY(100%)'
    };
    
    const animation = element.animate([
      { transform: transforms[direction], opacity: 0 },
      { transform: 'translate(0)', opacity: 1 }
    ], {
      duration,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    });
    
    return animation.finished;
  }
  
  static stagger(elements, animationFn, delay = 50) {
    const animations = [];
    
    elements.forEach((element, index) => {
      setTimeout(() => {
        animations.push(animationFn(element));
      }, index * delay);
    });
    
    return Promise.all(animations);
  }
}
```

### Implementation Tasks

1. **Create Component Library**
   - Build all UI components
   - Create Storybook documentation
   - Add unit tests

2. **Implement Design System**
   - Set up design tokens
   - Create theme system
   - Build style guide

3. **Update All Pages**
   - Replace old UI with new components
   - Ensure responsive design
   - Add animations

4. **Accessibility Audit**
   - Run automated tests
   - Manual keyboard testing
   - Screen reader testing

5. **Performance Optimization**
   - Optimize images
   - Lazy load components
   - Minimize repaints

---

## Phase 7: Testing & Quality Assurance

### Branch: `refactor/testing-qa-phase7`

### Objective
Implement comprehensive testing strategy covering unit tests, integration tests, E2E tests, and performance testing.

### Implementation Details

#### 7.1 Testing Framework Setup

**File: `jest.config.js`**
```javascript
module.exports = {
  preset: 'jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ]
};
```

#### 7.2 Unit Tests

**File: `tests/unit/components/PricingCalculator.test.js`**
```javascript
import { PricingCalculator } from '@/shared/components/pricing-calculator';

describe('PricingCalculator', () => {
  let calculator;
  
  beforeEach(() => {
    calculator = new PricingCalculator({
      embellishmentType: 'cap-embroidery',
      config: {
        ltmThreshold: 24,
        ltmFee: 50.00
      }
    });
    
    // Set test pricing data
    calculator.setPricingData({
      prices: {
        'OS': {
          '1-23': 25.00,
          '24-47': 23.00,
          '48-71': 21.00,
          '72+': 19.00
        }
      },
      tierData: {
        '1-23': { minQuantity: 1, maxQuantity: 23 },
        '24-47': { minQuantity: 24, maxQuantity: 47 },
        '48-71': { minQuantity: 48, maxQuantity: 71 },
        '72+': { minQuantity: 72, maxQuantity: Infinity }
      }
    });
  });
  
  describe('calculate', () => {
    test('calculates base pricing correctly', () => {
      const result = calculator.calculate({
        sizeBreakdown: { 'OS': 50 },
        quantity: 50
      });
      
      expect(result.baseUnitPrice).toBe(21.00);
      expect(result.basePrice).toBe(1050.00);
      expect(result.tier).toBe('48-71');
    });
    
    test('applies LTM fee for small quantities', () => {
      const result = calculator.calculate({
        sizeBreakdown: { 'OS': 10 },
        quantity: 10
      });
      
      expect(result.ltmFee).toBe(50.00);
      expect(result.total).toBe(300.00); // (10 * 25) + 50
    });
    
    test('no LTM fee for quantities >= threshold', () => {
      const result = calculator.calculate({
        sizeBreakdown: { 'OS': 24 },
        quantity: 24
      });
      
      expect(result.ltmFee).toBe(0);
      expect(result.total).toBe(552.00); // 24 * 23
    });
    
    test('handles cumulative pricing', () => {
      const result = calculator.calculate({
        sizeBreakdown: { 'OS': 25 },
        quantity: 25,
        existingQuantity: 25,
        cumulativePricing: true
      });
      
      // Total 50, so should get 48-71 tier pricing
      expect(result.tier).toBe('48-71');
      expect(result.baseUnitPrice).toBe(21.00);
    });
    
    test('calculates add-ons correctly', () => {
      calculator.calculateBacklogo = (enabled, quantity) => ({
        enabled,
        unitPrice: 5.00,
        total: enabled ? quantity * 5.00 : 0
      });
      
      const result = calculator.calculate({
        sizeBreakdown: { 'OS': 10 },
        quantity: 10,
        additionalOptions: {
          backlogo: true
        }
      });
      
      expect(result.addOns.backlogo.total).toBe(50.00);
      expect(result.total).toBe(350.00); // 250 + 50 (LTM) + 50 (backlogo)
    });
  });
  
  describe('determineTier', () => {
    test('returns correct tier for quantity', () => {
      expect(calculator.determineTier(10)).toBe('1-23');
      expect(calculator.determineTier(24)).toBe('24-47');
      expect(calculator.determineTier(50)).toBe('48-71');
      expect(calculator.determineTier(100)).toBe('72+');
    });
  });
  
  describe('getNextTierInfo', () => {
    test('returns next tier information', () => {
      const nextTier = calculator.getNextTierInfo(20);
      
      expect(nextTier.tier).toBe('24-47');
      expect(nextTier.minQuantity).toBe(24);
      expect(nextTier.quantityNeeded).toBe(4);
    });
    
    test('returns null at highest tier', () => {
      const nextTier = calculator.getNextTierInfo(100);
      expect(nextTier).toBeNull();
    });
  });
});
```

#### 7.3 Integration Tests

**File: `tests/integration/cap-embroidery-flow.test.js`**
```javascript
import { CapEmbroideryController } from '@/pages/cap-embroidery/modules/controller';
import { Store } from '@/shared/state/store';
import { mockCaspioResponse } from '../mocks/caspio';

describe('Cap Embroidery Integration', () => {
  let controller;
  let store;
  
  beforeEach(async () => {
    // Set up DOM
    document.body.innerHTML = `
      <div id="pricing-matrix-container"></div>
      <div id="size-quantity-grid"></div>
      <div id="add-to-cart-section"></div>
      <iframe id="caspio-pricing-iframe"></iframe>
    `;
    
    // Create store
    store = new Store();
    
    // Create controller
    controller = new CapEmbroideryController({ store });
    
    // Mock Caspio communication
    window.postMessage = jest.fn();
    
    // Initialize
    await controller.initialize();
  });
  
  test('loads pricing data from Caspio', async () => {
    // Simulate Caspio response
    const event = new MessageEvent('message', {
      origin: 'https://c7ect892.caspio.com',
      data: {
        type: 'PRICING_DATA_READY',
        data: mockCaspioResponse
      }
    });
    
    window.dispatchEvent(event);
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check state
    const state = store.getState();
    expect(state.pricing.data).toEqual(mockCaspioResponse);
  });
  
  test('calculates pricing when quantities change', async () => {
    // Set pricing data
    store.dispatch({
      type: 'PRICING_DATA_LOADED_SUCCESS',
      payload: mockCaspioResponse
    });
    
    // Enter quantities
    const input = document.querySelector('input[data-size="OS"]');
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    
    // Wait for calculation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check calculation
    const state = store.getState();
    expect(state.pricing.currentCalculation).toBeDefined();
    expect(state.pricing.currentCalculation.quantity).toBe(50);
  });
  
  test('adds item to quote', async () => {
    // Set up product data
    document.getElementById('product-title-context').textContent = 'Richardson 112';
    document.getElementById('product-style-context').textContent = '112';
    document.getElementById('pricing-color-name').textContent = 'Black';
    
    // Set pricing data
    store.dispatch({
      type: 'PRICING_DATA_LOADED_SUCCESS',
      payload: mockCaspioResponse
    });
    
    // Enter quantities
    const input = document.querySelector('input[data-size="OS"]');
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    
    // Click add to quote
    const addButton = document.getElementById('add-to-quote-btn');
    addButton.click();
    
    // Wait for quote update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check quote
    const state = store.getState();
    expect(state.quote.items).toHaveLength(1);
    expect(state.quote.items[0].quantity).toBe(50);
  });
});
```

#### 7.4 E2E Tests

**File: `tests/e2e/cap-embroidery.spec.js`**
```javascript
// Using Playwright
import { test, expect } from '@playwright/test';

test.describe('Cap Embroidery Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cap-embroidery-pricing.html?StyleNumber=112&COLOR=BLACK');
  });
  
  test('displays pricing matrix', async ({ page }) => {
    // Wait for pricing to load
    await page.waitForSelector('.pricing-matrix-table');
    
    // Check headers
    const headers = await page.$$eval('.pricing-matrix-table th', 
      els => els.map(el => el.textContent)
    );
    
    expect(headers).toContain('Quantity');
    expect(headers).toContain('OS');
  });
  
  test('calculates price based on quantity', async ({ page }) => {
    // Enter quantity
    await page.fill('input[data-size="OS"]', '50');
    
    // Check total updates
    await expect(page.locator('.total-price')).toHaveText('$1,050.00');
    
    // Check active tier
    await expect(page.locator('.price-cell[data-tier="48-71"]')).toHaveClass(/active-tier/);
  });
  
  test('adds back logo option', async ({ page }) => {
    // Enable back logo
    await page.check('#back-logo-checkbox');
    
    // Check details appear
    await expect(page.locator('.back-logo-details')).toBeVisible();
    
    // Adjust stitch count
    await page.click('.btn-increment');
    
    // Check price updates
    await expect(page.locator('#back-logo-price')).toHaveText('6.00');
  });
  
  test('saves quote', async ({ page }) => {
    // Enter quantities
    await page.fill('input[data-size="OS"]', '50');
    
    // Add to quote
    await page.click('#add-to-quote-btn');
    
    // Check quote summary updates
    await expect(page.locator('.quote-item')).toHaveCount(1);
    
    // Save quote
    await page.click('#save-quote-btn');
    
    // Check modal appears
    await expect(page.locator('.quote-saved-modal')).toBeVisible();
    
    // Check quote ID is displayed
    const quoteId = await page.locator('#quote-id-input').inputValue();
    expect(quoteId).toMatch(/^Q_\d{14}$/);
  });
  
  test('handles validation errors', async ({ page }) => {
    // Try to add without quantity
    await page.click('#add-to-quote-btn');
    
    // Check error message
    await expect(page.locator('.alert-warning')).toHaveText('Please enter at least one quantity');
    
    // Enter invalid quantity
    await page.fill('input[data-size="OS"]', '0');
    await page.click('#add-to-quote-btn');
    
    // Check error persists
    await expect(page.locator('.alert-warning')).toBeVisible();
  });
  
  test('responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check mobile quote bar
    await expect(page.locator('.mobile-quote-bar')).toBeVisible();
    
    // Check sidebar hidden
    await expect(page.locator('.pricing-sidebar')).not.toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Test desktop view
    await page.setViewportSize({ width: 1440, height: 900 });
    
    // Check sidebar visible
    await expect(page.locator('.pricing-sidebar')).toBeVisible();
    
    // Check mobile quote bar hidden
    await expect(page.locator('.mobile-quote-bar')).not.toBeVisible();
  });
});
```

#### 7.5 Performance Tests

**File: `tests/performance/load-time.test.js`**
```javascript
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  test('page loads within 2 seconds', async () => {
    const start = performance.now();
    
    // Simulate page load
    await import('@/pages/cap-embroidery');
    
    const end = performance.now();
    const loadTime = end - start;
    
    expect(loadTime).toBeLessThan(2000);
  });
  
  test('pricing calculation under 100ms', () => {
    const calculator = new PricingCalculator();
    
    // Set up complex pricing data
    const pricingData = generateComplexPricingData();
    calculator.setPricingData(pricingData);
    
    const start = performance.now();
    
    // Calculate pricing for 100 different scenarios
    for (let i = 0; i < 100; i++) {
      calculator.calculate({
        quantity: Math.floor(Math.random() * 1000),
        sizeBreakdown: generateRandomSizeBreakdown()
      });
    }
    
    const end = performance.now();
    const avgTime = (end - start) / 100;
    
    expect(avgTime).toBeLessThan(1); // Less than 1ms per calculation
  });
  
  test('memory usage stays under limit', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create and destroy 1000 components
    for (let i = 0; i < 1000; i++) {
      const component = new PricingMatrix();
      component.setPricingData(generatePricingData());
      component.destroy();
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Should not leak more than 10MB
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

#### 7.6 Visual Regression Tests

**File: `tests/visual/cap-embroidery.visual.js`**
```javascript
// Using Percy or similar tool
import percySnapshot from '@percy/playwright';

test('cap embroidery pricing page visual', async ({ page }) => {
  await page.goto('/cap-embroidery-pricing.html');
  
  // Wait for everything to load
  await page.waitForLoadState('networkidle');
  
  // Take snapshots at different states
  await percySnapshot(page, 'Cap Embroidery - Initial Load');
  
  // Enter quantities
  await page.fill('input[data-size="OS"]', '50');
  await percySnapshot(page, 'Cap Embroidery - With Quantities');
  
  // Enable back logo
  await page.check('#back-logo-checkbox');
  await percySnapshot(page, 'Cap Embroidery - Back Logo Enabled');
  
  // Add to quote
  await page.click('#add-to-quote-btn');
  await percySnapshot(page, 'Cap Embroidery - Quote Added');
  
  // Test responsive views
  await page.setViewportSize({ width: 375, height: 667 });
  await percySnapshot(page, 'Cap Embroidery - Mobile');
  
  await page.setViewportSize({ width: 768, height: 1024 });
  await percySnapshot(page, 'Cap Embroidery - Tablet');
});
```

### Testing Strategy

1. **Unit Testing (80% coverage)**
   - Test all pure functions
   - Test component methods
   - Test state reducers
   - Mock external dependencies

2. **Integration Testing**
   - Test module interactions
   - Test API integrations
   - Test state management
   - Test event flows

3. **E2E Testing**
   - Test complete user flows
   - Test across browsers
   - Test responsive design
   - Test error scenarios

4. **Performance Testing**
   - Load time benchmarks
   - Runtime performance
   - Memory usage
   - Bundle size limits

5. **Visual Testing**
   - Snapshot testing
   - Cross-browser rendering
   - Responsive layouts
   - Animation testing

---

## Phase 8: Performance Optimization & Deployment

### Branch: `refactor/performance-deployment-phase8`

### Objective
Optimize application performance and prepare for production deployment with monitoring and analytics.

### Implementation Details

#### 8.1 Bundle Optimization

**File: `webpack.prod.config.js`**
```javascript
const { merge } = require('webpack-merge');
const common = require('./webpack.config.js');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const WorkboxPlugin = require('workbox-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: { ecma: 8 },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug']
          },
          mangle: { safari10: true },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true
          }
        }
      }),
      new CssMinimizerPlugin()
    ],
    
    runtimeChunk: 'single',
    
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `npm.${packageName.replace('@', '')}`;
          }
        },
        common: {
          minChunks: 2,
          priority: -10,
          reuseExistingChunk: true
        },
        styles: {
          name: 'styles',
          type: 'css/mini-extract',
          chunks: 'all',
          enforce: true
        }
      }
    }
  },
  
  plugins: [
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8
    }),
    
    new CompressionPlugin({
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
      filename: '[path][base].br'
    }),
    
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    }),
    
    new WorkboxPlugin.GenerateSW({
      clientsClaim: true,
      skipWaiting: true,
      runtimeCaching: [{
        urlPattern: /^https:\/\/caspio-pricing-proxy/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 300 // 5 minutes
          }
        }
      }]
    })
  ]
});
```

#### 8.2 Performance Monitoring

**File: `src/shared/monitoring/performance.js`**
```javascript
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      navigation: {},
      resources: [],
      interactions: [],
      errors: []
    };
    
    this.observers = new Map();
    this.startTime = performance.now();
    
    this.init();
  }
  
  init() {
    // Navigation timing
    this.collectNavigationTiming();
    
    // Resource timing
    this.observeResources();
    
    // User interactions
    this.observeInteractions();
    
    // Core Web Vitals
    this.observeWebVitals();
    
    // JavaScript errors
    this.observeErrors();
    
    // Send metrics periodically
    this.startReporting();
  }
  
  collectNavigationTiming() {
    if (performance.timing) {
      const timing = performance.timing;
      const navigationStart = timing.navigationStart;
      
      this.metrics.navigation = {
        // Page load metrics
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        ttfb: timing.responseStart - navigationStart,
        download: timing.responseEnd - timing.responseStart,
        domInteractive: timing.domInteractive - navigationStart,
        domComplete: timing.domComplete - navigationStart,
        loadComplete: timing.loadEventEnd - navigationStart,
        
        // Calculated metrics
        firstPaint: this.getFirstPaint(),
        firstContentfulPaint: this.getFirstContentfulPaint(),
        largestContentfulPaint: 0, // Will be updated by observer
        firstInputDelay: 0,
        cumulativeLayoutShift: 0
      };
    }
  }
  
  observeWebVitals() {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.navigation.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
        });
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (e) {
        console.error('LCP observer error:', e);
      }
      
      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.metrics.navigation.firstInputDelay = entry.processingStart - entry.startTime;
          });
        });
        
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.set('fid', fidObserver);
      } catch (e) {
        console.error('FID observer error:', e);
      }
      
      // Cumulative Layout Shift
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              this.metrics.navigation.cumulativeLayoutShift = clsValue;
            }
          }
        });
        
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      } catch (e) {
        console.error('CLS observer error:', e);
      }
    }
  }
  
  observeResources() {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.resources.push({
            name: entry.name,
            type: entry.initiatorType,
            duration: entry.duration,
            size: entry.transferSize || 0,
            cached: entry.transferSize === 0
          });
        }
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);
    }
  }
  
  trackInteraction(name, data = {}) {
    this.metrics.interactions.push({
      name,
      timestamp: performance.now(),
      data,
      duration: data.duration || 0
    });
  }
  
  getReport() {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      sessionDuration: performance.now() - this.startTime,
      metrics: this.metrics,
      summary: {
        // Core Web Vitals
        lcp: this.metrics.navigation.largestContentfulPaint,
        fid: this.metrics.navigation.firstInputDelay,
        cls: this.metrics.navigation.cumulativeLayoutShift,
        
        // Other key metrics
        ttfb: this.metrics.navigation.ttfb,
        loadTime: this.metrics.navigation.loadComplete,
        resourceCount: this.metrics.resources.length,
        totalResourceSize: this.metrics.resources.reduce((sum, r) => sum + r.size, 0),
        cachedResources: this.metrics.resources.filter(r => r.cached).length,
        errorCount: this.metrics.errors.length
      }
    };
  }
  
  async sendReport() {
    const report = this.getReport();
    
    // Send to analytics endpoint
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/performance', JSON.stringify(report));
    } else {
      fetch('/api/analytics/performance', {
        method: 'POST',
        body: JSON.stringify(report),
        keepalive: true
      });
    }
    
    // Also send to Google Analytics if available
    if (window.gtag) {
      window.gtag('event', 'performance', {
        event_category: 'Web Vitals',
        event_label: 'LCP',
        value: Math.round(report.summary.lcp),
        non_interaction: true
      });
    }
  }
}
```

#### 8.3 Error Tracking

**File: `src/shared/monitoring/error-tracker.js`**
```javascript
export class ErrorTracker {
  constructor(config = {}) {
    this.config = {
      endpoint: '/api/errors',
      sampleRate: 1.0, // 100% by default
      ignorePatterns: [
        /ResizeObserver loop limit exceeded/,
        /Non-Error promise rejection captured/
      ],
      ...config
    };
    
    this.errors = [];
    this.init();
  }
  
  init() {
    // Global error handler
    window.addEventListener('error', this.handleError.bind(this));
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleRejection.bind(this));
    
    // Override console.error
    const originalError = console.error;
    console.error = (...args) => {
      this.captureConsoleError(args);
      originalError.apply(console, args);
    };
  }
  
  handleError(event) {
    const error = {
      type: 'javascript',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    this.captureError(error);
  }
  
  handleRejection(event) {
    const error = {
      type: 'unhandled_promise',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    this.captureError(error);
  }
  
  captureError(error) {
    // Check sample rate
    if (Math.random() > this.config.sampleRate) {
      return;
    }
    
    // Check ignore patterns
    const shouldIgnore = this.config.ignorePatterns.some(pattern => 
      pattern.test(error.message)
    );
    
    if (shouldIgnore) {
      return;
    }
    
    // Add context
    error.context = {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height
      },
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    };
    
    // Store error
    this.errors.push(error);
    
    // Send immediately for critical errors
    if (error.type === 'javascript' || this.errors.length >= 10) {
      this.sendErrors();
    }
  }
  
  async sendErrors() {
    if (this.errors.length === 0) return;
    
    const errors = [...this.errors];
    this.errors = [];
    
    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ errors })
      });
    } catch (e) {
      // Put errors back if send failed
      this.errors.unshift(...errors);
    }
  }
}
```

#### 8.4 Analytics Integration

**File: `src/shared/analytics/tracker.js`**
```javascript
export class AnalyticsTracker {
  constructor() {
    this.queue = [];
    this.sessionId = this.generateSessionId();
    this.init();
  }
  
  init() {
    // Google Analytics 4
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', 'GA_MEASUREMENT_ID');
    }
    
    // Custom analytics
    this.setupPageTracking();
    this.setupEventTracking();
    this.setupEcommerceTracking();
  }
  
  setupPageTracking() {
    // Track page views
    this.trackPageView();
    
    // Track time on page
    let startTime = Date.now();
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Date.now() - startTime;
      this.track('page_timing', {
        page: window.location.pathname,
        time_on_page: timeOnPage
      });
    });
  }
  
  setupEventTracking() {
    // Auto-track clicks on CTAs
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-track]');
      if (target) {
        const eventName = target.dataset.track;
        const eventData = JSON.parse(target.dataset.trackData || '{}');
        this.track(eventName, eventData);
      }
    });
    
    // Track form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.dataset.trackSubmit) {
        this.track('form_submit', {
          form_id: form.id,
          form_name: form.name
        });
      }
    });
  }
  
  setupEcommerceTracking() {
    // Track product views
    if (window.location.pathname.includes('pricing')) {
      const productData = this.getProductData();
      if (productData) {
        this.trackEcommerce('view_item', {
          currency: 'USD',
          value: 0,
          items: [productData]
        });
      }
    }
  }
  
  track(eventName, parameters = {}) {
    // Add default parameters
    const enrichedParams = {
      ...parameters,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      page_url: window.location.href,
      page_title: document.title
    };
    
    // Send to Google Analytics
    if (window.gtag) {
      gtag('event', eventName, enrichedParams);
    }
    
    // Send to custom analytics
    this.queue.push({
      event: eventName,
      parameters: enrichedParams
    });
    
    // Batch send
    if (this.queue.length >= 10) {
      this.flush();
    }
  }
  
  trackEcommerce(eventName, data) {
    if (window.gtag) {
      gtag('event', eventName, data);
    }
  }
  
  async flush() {
    if (this.queue.length === 0) return;
    
    const events = [...this.queue];
    this.queue = [];
    
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events })
      });
    } catch (e) {
      // Put events back if send failed
      this.queue.unshift(...events);
    }
  }
  
  generateSessionId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 8.5 Deployment Configuration

**File: `deployment/nginx.conf`**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name pricing.northwestcustomapparel.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pricing.northwestcustomapparel.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/pricing.northwestcustomapparel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pricing.northwestcustomapparel.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://www.google-analytics.com https://c7ect892.caspio.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Brotli compression
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Cache control
    location ~* \.(js|css)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    
    location ~* \.(jpg|jpeg|png|gif|ico|svg|woff|woff2)$ {
        add_header Cache-Control "public, max-age=86400";
    }
    
    # Serve pre-compressed files
    location ~ \.(js|css|html)$ {
        gzip_static on;
        brotli_static on;
    }
    
    # API proxy
    location /api/ {
        proxy_pass https://caspio-pricing-proxy-ab30a049961a.herokuapp.com;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache API responses
        proxy_cache api_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;
    }
    
    # Root directory
    root /var/www/pricing;
    index index.html;
    
    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}
```

**File: `deployment/docker-compose.yml`**
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_URL=https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      
  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./dist:/var/www/pricing
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
```

### Deployment Process

1. **Build Production Assets**
   ```bash
   npm run build
   npm run test
   npm run analyze
   ```

2. **Deploy to Staging**
   ```bash
   docker-compose -f docker-compose.staging.yml up -d
   npm run e2e:staging
   ```

3. **Performance Testing**
   - Run Lighthouse CI
   - Load testing with k6
   - Real user monitoring setup

4. **Deploy to Production**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   npm run smoke-tests
   ```

5. **Monitor**
   - Check error rates
   - Monitor performance metrics
   - Track conversion rates

---

## Implementation Timeline

### Month 1
- Week 1-2: Phase 3 (State Management)
- Week 3-4: Phase 4 (Cap Embroidery Migration)

### Month 2
- Week 1-2: Phase 5 (API Consolidation)
- Week 3-4: Phase 6 (UI/UX Redesign)

### Month 3
- Week 1-2: Phase 7 (Testing)
- Week 3-4: Phase 8 (Performance & Deployment)

### Total Effort Estimate
- 3 months with 2 developers
- 1 month with 4 developers (accelerated)

---

## Success Metrics

### Performance
- **Page Load Time**: < 2 seconds on 3G
- **Time to Interactive**: < 3 seconds
- **Lighthouse Score**: > 95
- **Bundle Size**: < 200KB gzipped

### Quality
- **Test Coverage**: > 80%
- **Error Rate**: < 0.1%
- **Accessibility Score**: WCAG 2.1 AA compliant

### Business
- **Conversion Rate**: +20% improvement
- **Quote Completion**: +30% improvement
- **Support Tickets**: -50% reduction
- **Developer Velocity**: 2x faster feature development

### Technical
- **Code Duplication**: -90% reduction
- **Build Time**: < 2 minutes
- **Deploy Time**: < 5 minutes
- **Resource Count**: From 63 to 4 files

---

## Risk Mitigation

### Technical Risks
1. **Browser Compatibility**
   - Solution: Progressive enhancement
   - Fallbacks: Polyfills for older browsers

2. **API Migration**
   - Solution: Gradual rollout with feature flags
   - Fallbacks: Keep old endpoints active

3. **Data Loss**
   - Solution: Comprehensive backups
   - Fallbacks: Rollback procedures

### Business Risks
1. **User Disruption**
   - Solution: A/B testing rollout
   - Communication: Email notifications

2. **Training Required**
   - Solution: Video tutorials
   - Documentation: User guides

3. **SEO Impact**
   - Solution: 301 redirects
   - Monitoring: Search console tracking

---

## Conclusion

This comprehensive refactoring plan transforms the Northwest Custom Apparel pricing system from a legacy codebase into a modern, scalable application. Each phase builds upon the previous, ensuring a smooth transition while maintaining business continuity.

The key to success is incremental implementation with continuous testing and monitoring. By following this roadmap, the development team can deliver a superior user experience while significantly reducing technical debt and improving developer productivity.