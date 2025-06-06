// Core bundle - shared functionality across all pricing pages
// This replaces multiple duplicate scripts with a single consolidated module

// Import core utilities
import { EventBus } from '../shared/utils/event-bus';
import { Logger } from '../shared/utils/logger';
import { ApiClient } from '../shared/utils/api-client';
import { StorageManager } from '../shared/utils/storage-manager';

// Import core components
import { PricingCalculator } from '../shared/components/pricing-calculator';
import { QuoteSystem } from '../shared/components/quote-system';
import { ColorSelector } from '../shared/components/color-selector';
import { ImageGallery } from '../shared/components/image-gallery';

// Import core styles
import '../shared/styles/core.css';
import '../shared/styles/components.css';

// Initialize global namespace
window.NWCA = window.NWCA || {};

// Core module initialization
class CoreModule {
  constructor() {
    this.eventBus = new EventBus();
    this.logger = new Logger('NWCA-Core');
    this.apiClient = new ApiClient();
    this.storage = new StorageManager();
    
    // Expose to global namespace for backwards compatibility
    window.NWCA.core = {
      eventBus: this.eventBus,
      logger: this.logger,
      apiClient: this.apiClient,
      storage: this.storage
    };
  }
  
  initialize() {
    this.logger.log('Initializing core module...');
    
    // Set up global error handling
    this.setupErrorHandling();
    
    // Initialize performance monitoring
    this.initPerformanceMonitoring();
    
    // Set up common event listeners
    this.setupCommonListeners();
    
    this.logger.log('Core module initialized');
  }
  
  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      this.logger.error('Global error:', event.error);
      // Send to analytics if needed
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.logger.error('Unhandled promise rejection:', event.reason);
    });
  }
  
  initPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.logger.debug('Performance entry:', entry);
        }
      });
      
      observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
    }
  }
  
  setupCommonListeners() {
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.eventBus.emit('page:hidden');
      } else {
        this.eventBus.emit('page:visible');
      }
    });
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.eventBus.emit('network:online');
    });
    
    window.addEventListener('offline', () => {
      this.eventBus.emit('network:offline');
    });
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const core = new CoreModule();
    core.initialize();
  });
} else {
  const core = new CoreModule();
  core.initialize();
}

// Export for use in other modules
export { CoreModule, EventBus, Logger, ApiClient, StorageManager };