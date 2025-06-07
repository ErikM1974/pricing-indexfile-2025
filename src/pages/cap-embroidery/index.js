// Cap Embroidery Page Entry Point
// Phase 2: Component Architecture Implementation

import { EventBus } from '../../core/event-bus';
import { Logger } from '../../core/logger';
import { ApiClient } from '../../core/api-client';
import { StorageManager } from '../../core/storage-manager';

// Import components
import { CapEmbroideryCalculator } from './calculator';
import { LocationManager } from './components/location-manager';
import { ColorSelector } from '../../shared/components/color-selector';
import { QuoteSystem } from '../../shared/components/quote-system';
import { ImageGallery } from '../../shared/components/image-gallery';

// Import utilities
import { formatCurrency, debounce } from '../../shared/utils';

// Import styles
import './styles/cap-embroidery.css';

class CapEmbroideryPage {
  constructor() {
    // Core utilities
    this.eventBus = new EventBus();
    this.logger = new Logger('CapEmbroidery');
    this.api = new ApiClient('/api');
    this.storage = new StorageManager('cap-embroidery');
    
    // State management
    this.state = {
      quantity: 1,
      capType: 'structured',
      color: null,
      locations: [],
      stitchCounts: {},
      pricing: null
    };
    
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
      this.logger.info('Initializing cap embroidery page with component architecture');
      
      // Initialize components
      await this.initializeComponents();
      
      // Load pricing data
      await this.loadPricingData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Restore saved state
      this.restoreState();
      
      // Initial calculation
      this.recalculate();
      
      this.logger.info('Cap embroidery page initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize cap embroidery page:', error);
      this.showError('Failed to load pricing calculator. Please refresh the page.');
    }
  }
  
  async initializeComponents() {
    // Initialize calculator
    this.components.calculator = new CapEmbroideryCalculator({
      pricingMatrix: window.CAP_PRICING_MATRIX // Will be replaced with API data
    });
    
    // Initialize location manager
    this.components.locationManager = new LocationManager({
      container: '#location-selector',
      eventBus: this.eventBus,
      onChange: (data) => this.handleLocationChange(data)
    });
    
    // Initialize color selector
    this.components.colorSelector = new ColorSelector({
      container: '#color-selector',
      colors: await this.getAvailableColors(),
      multiSelect: false,
      onChange: (colors) => this.handleColorChange(colors[0])
    });
    
    // Initialize quote system
    this.components.quoteSystem = new QuoteSystem({
      container: '#quote-widget',
      calculator: this.components.calculator,
      storage: this.storage,
      api: this.api,
      onSave: (quote) => this.handleQuoteSave(quote),
      onLoad: (quote) => this.handleQuoteLoad(quote)
    });
    
    // Initialize image gallery
    this.components.imageGallery = new ImageGallery({
      container: '#product-images',
      images: this.getProductImages(),
      showThumbnails: true,
      enableZoom: true
    });
    
    // Initialize quantity controls
    this.initializeQuantityControls();
    
    // Initialize cap type selector
    this.initializeCapTypeSelector();
    
    this.logger.info('All components initialized');
  }
  
  async loadPricingData() {
    try {
      // Check for global pricing matrix first
      if (window.CAP_PRICING_MATRIX) {
        this.pricingMatrix = window.CAP_PRICING_MATRIX;
        this.logger.info('Using global pricing matrix');
      } else {
        // Load from API
        const response = await this.api.get('/pricing/cap-embroidery');
        this.pricingMatrix = response.data;
        this.logger.info('Loaded pricing matrix from API');
      }
      
      // Update calculator with pricing data
      if (this.components.calculator) {
        this.components.calculator.setPricingMatrix(this.pricingMatrix);
      }
    } catch (error) {
      this.logger.error('Failed to load pricing data:', error);
      // Use fallback pricing
      this.pricingMatrix = this.getDefaultPricingMatrix();
    }
  }
  
  setupEventListeners() {
    // Component events
    this.eventBus.on('location:change', (data) => {
      this.state.locations = data.locations;
      this.state.stitchCounts = data.stitchCounts;
      this.recalculate();
    });
    
    this.eventBus.on('color:change', (color) => {
      this.state.color = color;
      this.saveState();
    });
    
    this.eventBus.on('quote:saved', (quote) => {
      this.showSuccess('Quote saved successfully!');
    });
    
    // Page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates();
      }
    });
  }
  
  initializeQuantityControls() {
    const quantityInput = document.getElementById('quantity');
    const decreaseBtn = document.getElementById('quantity-decrease');
    const increaseBtn = document.getElementById('quantity-increase');
    
    if (quantityInput) {
      // Input changes
      quantityInput.addEventListener('input', debounce((e) => {
        this.updateQuantity(e.target.value);
      }, 300));
      
      // Keyboard navigation
      quantityInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.updateQuantity(this.state.quantity + 1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.updateQuantity(Math.max(1, this.state.quantity - 1));
        }
      });
    }
    
    // Button controls
    if (decreaseBtn) {
      decreaseBtn.addEventListener('click', () => {
        this.updateQuantity(Math.max(1, this.state.quantity - 1));
      });
    }
    
    if (increaseBtn) {
      increaseBtn.addEventListener('click', () => {
        this.updateQuantity(this.state.quantity + 1);
      });
    }
  }
  
  initializeCapTypeSelector() {
    const capTypeOptions = document.querySelectorAll('.cap-type-option');
    
    capTypeOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Remove selected from all
        capTypeOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Add selected to clicked
        option.classList.add('selected');
        
        // Update state
        this.state.capType = option.dataset.type;
        this.recalculate();
      });
      
      // Keyboard support
      option.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          option.click();
        }
      });
    });
  }
  
  handleLocationChange(data) {
    this.state.locations = data.locations;
    this.state.stitchCounts = data.stitchCounts;
    this.recalculate();
  }
  
  handleColorChange(color) {
    this.state.color = color;
    this.saveState();
    
    // Update product images if needed
    if (this.components.imageGallery) {
      const colorImages = this.getProductImages(color);
      this.components.imageGallery.updateImages(colorImages);
    }
  }
  
  handleQuoteSave(quote) {
    this.logger.info('Quote saved:', quote);
    this.showSuccess('Quote saved successfully!');
  }
  
  handleQuoteLoad(quote) {
    this.logger.info('Loading quote:', quote);
    
    // Restore state from quote
    if (quote.selections) {
      this.state = { ...this.state, ...quote.selections };
      
      // Update UI components
      if (quote.selections.locations && this.components.locationManager) {
        this.components.locationManager.setSelections({
          locations: quote.selections.locations,
          stitchCounts: quote.selections.stitchCounts
        });
      }
      
      if (quote.selections.color && this.components.colorSelector) {
        this.components.colorSelector.selectColor(quote.selections.color);
      }
      
      // Update quantity
      const quantityInput = document.getElementById('quantity');
      if (quantityInput && quote.selections.quantity) {
        quantityInput.value = quote.selections.quantity;
      }
      
      this.recalculate();
    }
  }
  
  updateQuantity(quantity) {
    const qty = parseInt(quantity) || 1;
    this.state.quantity = Math.max(1, qty);
    
    // Update input value
    const quantityInput = document.getElementById('quantity');
    if (quantityInput) {
      quantityInput.value = this.state.quantity;
    }
    
    this.recalculate();
  }
  
  recalculate() {
    // Validate selections
    const validation = this.components.calculator.validateSelections(this.state);
    
    if (!validation.isValid) {
      this.showValidationErrors(validation.errors);
      return;
    }
    
    // Show warnings if any
    if (validation.warnings.length > 0) {
      this.showValidationWarnings(validation.warnings);
    }
    
    // Calculate pricing
    const pricing = this.components.calculator.calculate(this.state.quantity, this.state);
    this.state.pricing = pricing;
    
    // Update displays
    this.updatePriceDisplay(pricing);
    
    // Update quote system
    if (this.components.quoteSystem) {
      this.components.quoteSystem.updatePrice(pricing);
    }
    
    // Save state
    this.saveState();
    
    // Emit pricing update event
    this.eventBus.emit('pricing:calculated', pricing);
  }
  
  updatePriceDisplay(pricing) {
    const priceDisplay = document.getElementById('price-display');
    const breakdownTable = document.getElementById('price-breakdown');
    
    if (priceDisplay) {
      priceDisplay.innerHTML = `
        <div class="price-summary">
          <div class="price-main">
            <span class="label">Total Price:</span>
            <span class="price">${formatCurrency(pricing.total)}</span>
          </div>
          <div class="price-unit">
            <span class="label">Per Item:</span>
            <span class="price">${formatCurrency(pricing.unitPrice)}</span>
          </div>
          ${pricing.savingsMessage ? `
            <div class="savings-tip">
              💡 ${pricing.savingsMessage}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    if (breakdownTable) {
      breakdownTable.innerHTML = `
        <table class="price-breakdown">
          <tr>
            <td>Base Cap Price:</td>
            <td>${formatCurrency(pricing.baseCapPrice)}</td>
          </tr>
          ${pricing.locationCount > 0 ? `
            <tr>
              <td>Embroidery (${pricing.totalStitches.toLocaleString()} stitches):</td>
              <td>${formatCurrency(pricing.embroideryPerUnit)}</td>
            </tr>
          ` : ''}
          <tr>
            <td>Unit Price:</td>
            <td>${formatCurrency(pricing.unitPrice)}</td>
          </tr>
          <tr>
            <td>Quantity:</td>
            <td>× ${pricing.quantity}</td>
          </tr>
          ${pricing.discount > 0 ? `
            <tr class="discount">
              <td>Volume Discount:</td>
              <td>-${formatCurrency(pricing.discount)}</td>
            </tr>
          ` : ''}
          ${pricing.setupFees > 0 ? `
            <tr>
              <td>Setup Fees (${pricing.locationCount} locations):</td>
              <td>${formatCurrency(pricing.setupFees)}</td>
            </tr>
          ` : ''}
          ${pricing.ltmFee > 0 ? `
            <tr>
              <td>Less Than Minimum Fee:</td>
              <td>${formatCurrency(pricing.ltmFee)}</td>
            </tr>
          ` : ''}
          <tr class="total">
            <td>Total:</td>
            <td>${formatCurrency(pricing.total)}</td>
          </tr>
        </table>
      `;
    }
  }
  
  showValidationErrors(errors) {
    const container = document.getElementById('validation-messages') || this.createValidationContainer();
    
    container.innerHTML = errors.map(error => `
      <div class="validation-error">
        <span class="icon">⚠️</span>
        <span class="message">${error}</span>
      </div>
    `).join('');
  }
  
  showValidationWarnings(warnings) {
    const container = document.getElementById('validation-warnings') || this.createWarningContainer();
    
    container.innerHTML = warnings.map(warning => `
      <div class="validation-warning">
        <span class="icon">ℹ️</span>
        <span class="message">${warning}</span>
      </div>
    `).join('');
  }
  
  createValidationContainer() {
    const container = document.createElement('div');
    container.id = 'validation-messages';
    container.className = 'validation-messages';
    
    const configSection = document.querySelector('.product-config');
    if (configSection) {
      configSection.insertBefore(container, configSection.firstChild);
    }
    
    return container;
  }
  
  createWarningContainer() {
    const container = document.createElement('div');
    container.id = 'validation-warnings';
    container.className = 'validation-warnings';
    
    const pricingSection = document.querySelector('.pricing-section');
    if (pricingSection) {
      pricingSection.insertBefore(container, pricingSection.firstChild);
    }
    
    return container;
  }
  
  async getAvailableColors() {
    // Get colors from page or API
    // For now, return default colors
    return [
      { id: 'black', name: 'Black', hex: '#000000' },
      { id: 'navy', name: 'Navy', hex: '#000080' },
      { id: 'red', name: 'Red', hex: '#FF0000' },
      { id: 'royal', name: 'Royal Blue', hex: '#4169E1' },
      { id: 'white', name: 'White', hex: '#FFFFFF' },
      { id: 'grey', name: 'Grey', hex: '#808080' },
      { id: 'khaki', name: 'Khaki', hex: '#F0E68C' },
      { id: 'green', name: 'Green', hex: '#008000' }
    ];
  }
  
  getProductImages(color = null) {
    // Get product images based on color
    const baseUrl = 'https://cdn.example.com/products/caps/';
    const images = [
      {
        src: `${baseUrl}front-${color || 'black'}.jpg`,
        alt: 'Cap Front View',
        caption: 'Front'
      },
      {
        src: `${baseUrl}back-${color || 'black'}.jpg`,
        alt: 'Cap Back View',
        caption: 'Back'
      },
      {
        src: `${baseUrl}side-${color || 'black'}.jpg`,
        alt: 'Cap Side View',
        caption: 'Side'
      }
    ];
    
    return images;
  }
  
  getDefaultPricingMatrix() {
    return {
      embroidery: {
        perThousandStitches: 1.50,
        minimumCharge: 7.50,
        setupFee: 40
      },
      caps: {
        structured: 8.50,
        unstructured: 7.50,
        trucker: 9.00
      }
    };
  }
  
  saveState() {
    this.storage.set('state', this.state);
    this.logger.debug('State saved:', this.state);
  }
  
  restoreState() {
    const savedState = this.storage.get('state');
    if (savedState) {
      this.state = { ...this.state, ...savedState };
      this.logger.info('State restored:', this.state);
      
      // Update UI components
      if (savedState.quantity) {
        const quantityInput = document.getElementById('quantity');
        if (quantityInput) {
          quantityInput.value = savedState.quantity;
        }
      }
      
      if (savedState.locations && this.components.locationManager) {
        this.components.locationManager.setSelections({
          locations: savedState.locations,
          stitchCounts: savedState.stitchCounts
        });
      }
      
      if (savedState.color && this.components.colorSelector) {
        this.components.colorSelector.selectColor(savedState.color);
      }
      
      if (savedState.capType) {
        const capOption = document.querySelector(`[data-type="${savedState.capType}"]`);
        if (capOption) {
          capOption.click();
        }
      }
    }
  }
  
  async checkForUpdates() {
    // Check for pricing updates when page becomes visible
    try {
      const response = await this.api.get('/pricing/cap-embroidery/version');
      if (response.version !== this.pricingVersion) {
        await this.loadPricingData();
        this.recalculate();
      }
    } catch (error) {
      this.logger.debug('Failed to check for updates:', error);
    }
  }
  
  showSuccess(message) {
    this.showNotification(message, 'success');
  }
  
  showError(message) {
    this.showNotification(message, 'error');
  }
  
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
}

// Initialize the page
const capEmbroideryPage = new CapEmbroideryPage();

// Export for testing
export { CapEmbroideryPage };