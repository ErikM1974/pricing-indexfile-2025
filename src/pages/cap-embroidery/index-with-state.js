// Cap Embroidery Page with State Management
// Phase 3: Integration Example

import { getDefaultStore } from '../../shared/state';
import { CapEmbroideryCalculator } from './calculator';
import { LocationManager } from './components/location-manager';
import { ColorSelector } from '../../shared/components/color-selector';
import { QuoteSystem } from '../../shared/components/quote-system';
import { ImageGallery } from '../../shared/components/image-gallery';

import './styles/cap-embroidery.css';

class CapEmbroideryPageWithState {
  constructor() {
    // Initialize state management
    this.stateManager = getDefaultStore({
      namespace: 'cap-embroidery',
      debug: true,
      performance: true,
      featureFlags: {
        multiColorSelection: false,
        sizeBreakdown: true,
        priceOptimization: true
      }
    });
    
    // Destructure for easier access
    const { store, actions, selectors, select } = this.stateManager;
    this.store = store;
    this.actions = actions;
    this.selectors = selectors;
    this.select = select;
    
    // Components will be initialized in init()
    this.components = {};
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }
  
  async init() {
    try {
      // Set loading state
      this.actions.setLoading(true, 'Initializing cap embroidery calculator...');
      
      // Initialize components
      await this.initializeComponents();
      
      // Load product data
      await this.loadProductData();
      
      // Set up subscriptions
      this.setupSubscriptions();
      
      // Set up UI event listeners
      this.setupEventListeners();
      
      // Clear loading state
      this.actions.setLoading(false);
      
      console.log('Cap embroidery page initialized with state management');
    } catch (error) {
      console.error('Failed to initialize:', error);
      this.actions.addError('Failed to initialize pricing calculator');
      this.actions.setLoading(false);
    }
  }
  
  async initializeComponents() {
    // Initialize calculator
    this.components.calculator = new CapEmbroideryCalculator();
    
    // Initialize location manager
    this.components.locationManager = new LocationManager({
      container: '#location-selector',
      onChange: (data) => {
        // Update state with location changes
        this.actions.updateLocations(data.locations);
        this.actions.updateCustomOptions({ stitchCounts: data.stitchCounts });
      }
    });
    
    // Initialize color selector
    this.components.colorSelector = new ColorSelector({
      container: '#color-selector',
      colors: await this.getAvailableColors(),
      onChange: (colors) => {
        this.actions.selectColor(colors[0]);
      }
    });
    
    // Initialize quote system
    this.components.quoteSystem = new QuoteSystem({
      container: '#quote-widget',
      onSave: async (quoteName) => {
        await this.actions.saveCurrentQuote(quoteName);
      },
      onLoad: async (quoteId) => {
        await this.actions.loadQuote(quoteId);
      }
    });
    
    // Initialize image gallery
    this.components.imageGallery = new ImageGallery({
      container: '#product-images',
      images: this.getProductImages()
    });
  }
  
  async loadProductData() {
    // Get product data from page or API
    const productData = {
      id: 'cap-001',
      styleNumber: 'PC-112',
      name: 'Premium Structured Cap',
      category: 'cap-embroidery',
      basePrice: 8.50,
      colors: await this.getAvailableColors(),
      sizes: ['OS'],
      options: {
        types: ['structured', 'unstructured', 'trucker']
      }
    };
    
    // Load product into state
    await this.actions.loadProduct(productData);
    
    // Set embellishment type
    this.actions.setEmbellishmentType('embroidery');
  }
  
  setupSubscriptions() {
    // Subscribe to selection changes
    this.store.subscribe((state) => {
      // Recalculate pricing when selections change
      if (this.select(this.selectors.isReadyToCalculate)) {
        this.actions.calculatePricing(this.components.calculator);
      }
    }, {
      selector: 'selections'
    });
    
    // Subscribe to pricing changes
    this.store.subscribe((state) => {
      const pricing = this.select(this.selectors.getPricingSummary);
      this.updatePriceDisplay(pricing);
      
      // Update quote system
      if (this.components.quoteSystem) {
        this.components.quoteSystem.updatePrice(pricing);
      }
    }, {
      selector: 'pricing'
    });
    
    // Subscribe to UI state changes
    this.store.subscribe((state) => {
      const errors = this.select(this.selectors.getErrors);
      const warnings = this.select(this.selectors.getWarnings);
      
      this.updateValidationDisplay(errors, warnings);
    }, {
      selector: 'ui'
    });
    
    // Subscribe to quote changes
    this.store.subscribe((state) => {
      const quotes = this.select(this.selectors.getSavedQuotes);
      const currentQuote = this.select(this.selectors.getCurrentQuote);
      
      if (this.components.quoteSystem) {
        this.components.quoteSystem.updateQuotes(quotes, currentQuote);
      }
    }, {
      selector: 'quotes'
    });
  }
  
  setupEventListeners() {
    // Quantity controls
    const quantityInput = document.getElementById('quantity');
    if (quantityInput) {
      quantityInput.addEventListener('input', (e) => {
        this.actions.updateQuantity(parseInt(e.target.value) || 1);
      });
      
      // Set initial value from state
      quantityInput.value = this.select(this.selectors.getQuantity);
    }
    
    // Cap type selector
    const capTypeOptions = document.querySelectorAll('.cap-type-option');
    capTypeOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.actions.updateCustomOptions({ capType: option.dataset.type });
        
        // Update UI
        capTypeOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      });
    });
    
    // Undo/Redo buttons
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.stateManager.undo();
      });
      
      // Update button state
      this.store.subscribe(() => {
        undoBtn.disabled = !this.stateManager.canUndo();
      });
    }
    
    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        this.stateManager.redo();
      });
      
      // Update button state
      this.store.subscribe(() => {
        redoBtn.disabled = !this.stateManager.canRedo();
      });
    }
    
    // Debug button
    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => {
        console.log('Current State:', this.stateManager.export());
      });
    }
  }
  
  updatePriceDisplay(pricing) {
    const priceDisplay = document.getElementById('price-display');
    if (priceDisplay) {
      priceDisplay.innerHTML = `
        <div class="price-summary">
          <div class="price-main">
            <span class="label">Total Price:</span>
            <span class="price">$${pricing.totalPrice.toFixed(2)}</span>
          </div>
          <div class="price-unit">
            <span class="label">Per Item:</span>
            <span class="price">$${pricing.unitPrice.toFixed(2)}</span>
          </div>
          <div class="price-details">
            <div>Quantity: ${pricing.quantity}</div>
            <div>Subtotal: $${pricing.subtotal.toFixed(2)}</div>
            ${pricing.setupFees > 0 ? `<div>Setup Fees: $${pricing.setupFees.toFixed(2)}</div>` : ''}
            ${pricing.discount > 0 ? `<div class="discount">Discount: -$${pricing.discount.toFixed(2)}</div>` : ''}
          </div>
        </div>
      `;
    }
  }
  
  updateValidationDisplay(errors, warnings) {
    const validationContainer = document.getElementById('validation-messages');
    if (!validationContainer) return;
    
    validationContainer.innerHTML = '';
    
    // Display errors
    errors.forEach(error => {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'validation-error';
      errorDiv.innerHTML = `<span class="icon">⚠️</span> ${error}`;
      validationContainer.appendChild(errorDiv);
    });
    
    // Display warnings
    warnings.forEach(warning => {
      const warningDiv = document.createElement('div');
      warningDiv.className = 'validation-warning';
      warningDiv.innerHTML = `<span class="icon">ℹ️</span> ${warning}`;
      validationContainer.appendChild(warningDiv);
    });
  }
  
  async getAvailableColors() {
    // In real implementation, this would fetch from API
    return [
      { id: 'black', name: 'Black', hex: '#000000' },
      { id: 'navy', name: 'Navy', hex: '#000080' },
      { id: 'red', name: 'Red', hex: '#FF0000' },
      { id: 'royal', name: 'Royal Blue', hex: '#4169E1' },
      { id: 'white', name: 'White', hex: '#FFFFFF' },
      { id: 'grey', name: 'Grey', hex: '#808080' }
    ];
  }
  
  getProductImages() {
    return [
      { src: '/images/cap-front.jpg', alt: 'Front View' },
      { src: '/images/cap-back.jpg', alt: 'Back View' },
      { src: '/images/cap-side.jpg', alt: 'Side View' }
    ];
  }
}

// Initialize the page
const capEmbroideryPage = new CapEmbroideryPageWithState();

// Export for testing
export { CapEmbroideryPageWithState };