// Cap Embroidery Page Entry Point
// Consolidates all cap embroidery specific functionality

import { Logger } from '../../shared/utils/logger';
import { EventBus } from '../../shared/utils/event-bus';

// Import cap embroidery specific modules
import { CapEmbroideryController } from './modules/controller';
import { CapEmbroideryPricing } from './modules/pricing';
import { CapEmbroideryQuote } from './modules/quote';
import { BackLogoAddon } from './modules/back-logo-addon';
import { CapEmbroideryValidation } from './modules/validation';

// Import styles
import './styles/cap-embroidery.css';

class CapEmbroideryPage {
  constructor() {
    this.logger = new Logger('CapEmbroidery');
    this.eventBus = window.NWCA?.core?.eventBus || new EventBus();
    
    // Initialize modules
    this.controller = new CapEmbroideryController(this.eventBus);
    this.pricing = new CapEmbroideryPricing(this.eventBus);
    this.quote = new CapEmbroideryQuote(this.eventBus);
    this.backLogoAddon = new BackLogoAddon(this.eventBus);
    this.validation = new CapEmbroideryValidation();
  }
  
  async initialize() {
    try {
      this.logger.info('Initializing cap embroidery page...');
      
      // Check if we're on the cap embroidery page
      if (!this.isCapEmbroideryPage()) {
        this.logger.debug('Not on cap embroidery page, skipping initialization');
        return;
      }
      
      // Initialize all modules
      await Promise.all([
        this.controller.initialize(),
        this.pricing.initialize(),
        this.quote.initialize(),
        this.backLogoAddon.initialize()
      ]);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load initial data
      await this.loadInitialData();
      
      this.logger.info('Cap embroidery page initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize cap embroidery page:', error);
      // Show user-friendly error message
      this.showErrorMessage('Failed to load pricing. Please refresh the page.');
    }
  }
  
  isCapEmbroideryPage() {
    // Check URL, title, or specific elements
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    
    return url.includes('cap-embroidery') || 
           title.includes('cap embroidery') ||
           document.getElementById('cap-embroidery-pricing') !== null;
  }
  
  setupEventListeners() {
    // Listen for pricing data updates
    this.eventBus.on('pricing:updated', (data) => {
      this.logger.debug('Pricing updated:', data);
      this.updateUI(data);
    });
    
    // Listen for quote updates
    this.eventBus.on('quote:updated', (quote) => {
      this.logger.debug('Quote updated:', quote);
      this.updateQuoteDisplay(quote);
    });
    
    // Listen for validation errors
    this.eventBus.on('validation:error', (error) => {
      this.logger.warn('Validation error:', error);
      this.showValidationError(error);
    });
  }
  
  async loadInitialData() {
    try {
      // Get product data from page
      const productData = this.getProductData();
      
      if (!productData.styleNumber || !productData.color) {
        throw new Error('Missing product information');
      }
      
      // Load pricing data
      await this.pricing.loadPricing(productData);
      
      // Check for existing quote
      const existingQuote = await this.quote.checkForActiveQuote();
      if (existingQuote) {
        this.quote.loadQuote(existingQuote);
      }
      
    } catch (error) {
      this.logger.error('Failed to load initial data:', error);
      throw error;
    }
  }
  
  getProductData() {
    return {
      styleNumber: document.getElementById('product-style-context')?.textContent || '',
      productName: document.getElementById('product-title-context')?.textContent || '',
      color: document.getElementById('pricing-color-name')?.textContent || '',
      colorCode: new URLSearchParams(window.location.search).get('COLOR') || ''
    };
  }
  
  updateUI(pricingData) {
    // Update pricing displays
    const priceElements = document.querySelectorAll('[data-price-display]');
    priceElements.forEach(element => {
      const size = element.dataset.size;
      const tier = element.dataset.tier;
      
      if (pricingData.prices[size] && pricingData.prices[size][tier]) {
        element.textContent = `$${pricingData.prices[size][tier].toFixed(2)}`;
      }
    });
  }
  
  updateQuoteDisplay(quote) {
    // Update quote summary
    const summaryElement = document.getElementById('quote-summary');
    if (summaryElement && quote) {
      summaryElement.innerHTML = this.quote.renderQuoteSummary(quote);
    }
  }
  
  showValidationError(error) {
    // Show validation error to user
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-warning';
    alertDiv.textContent = error.message;
    
    const container = document.getElementById('validation-messages');
    if (container) {
      container.appendChild(alertDiv);
      
      // Auto-hide after 5 seconds
      setTimeout(() => alertDiv.remove(), 5000);
    }
  }
  
  showErrorMessage(message) {
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.innerHTML = `
      <strong>Error:</strong> ${message}
      <button class="alert-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.insertBefore(errorDiv, document.body.firstChild);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const page = new CapEmbroideryPage();
    page.initialize();
  });
} else {
  const page = new CapEmbroideryPage();
  page.initialize();
}

// Export for testing
export { CapEmbroideryPage };