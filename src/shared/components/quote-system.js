// QuoteSystem - Base quote management component
// Provides core quote functionality that can be extended for specific embellishment types

import { Logger } from '../utils/logger';
import { EventBus } from '../utils/event-bus';
import { StorageManager } from '../utils/storage-manager';

export class QuoteSystem {
  constructor(options = {}) {
    this.logger = new Logger('QuoteSystem');
    this.eventBus = options.eventBus || new EventBus();
    this.storage = options.storage || new StorageManager('quote_');
    
    // Configuration
    this.config = {
      autoSave: true,
      autoSaveInterval: 30000, // 30 seconds
      maxItems: 100,
      expirationDays: 30,
      ...options.config
    };
    
    // Quote state
    this.currentQuote = this.initializeQuote();
    this.autoSaveTimer = null;
    
    // Bind methods
    this.saveQuote = this.saveQuote.bind(this);
  }
  
  // Initialize empty quote
  initializeQuote() {
    return {
      id: null,
      sessionId: this.generateSessionId(),
      items: [],
      customer: {
        name: '',
        email: '',
        phone: '',
        company: ''
      },
      totals: {
        subtotal: 0,
        ltmFees: 0,
        addOns: 0,
        tax: 0,
        total: 0
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: this.calculateExpirationDate(),
        source: window.location.href,
        userAgent: navigator.userAgent
      }
    };
  }
  
  // Generate unique session ID
  generateSessionId() {
    return `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Calculate expiration date
  calculateExpirationDate() {
    const date = new Date();
    date.setDate(date.getDate() + this.config.expirationDays);
    return date.toISOString();
  }
  
  // Add item to quote
  addItem(itemData) {
    this.logger.debug('Adding item to quote:', itemData);
    
    // Validate item data
    if (!this.validateItem(itemData)) {
      throw new Error('Invalid item data');
    }
    
    // Check max items
    if (this.currentQuote.items.length >= this.config.maxItems) {
      throw new Error(`Maximum of ${this.config.maxItems} items allowed per quote`);
    }
    
    // Create quote item
    const item = {
      id: this.generateItemId(),
      lineNumber: this.currentQuote.items.length + 1,
      ...itemData,
      addedAt: new Date().toISOString()
    };
    
    // Add to quote
    this.currentQuote.items.push(item);
    
    // Update totals
    this.updateTotals();
    
    // Emit event
    this.eventBus.emit('quote:itemAdded', {
      item,
      quote: this.currentQuote
    });
    
    // Auto save
    if (this.config.autoSave) {
      this.scheduleSave();
    }
    
    return item;
  }
  
  // Update existing item
  updateItem(itemId, updates) {
    this.logger.debug('Updating item:', itemId, updates);
    
    const itemIndex = this.currentQuote.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }
    
    // Update item
    this.currentQuote.items[itemIndex] = {
      ...this.currentQuote.items[itemIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Update totals
    this.updateTotals();
    
    // Emit event
    this.eventBus.emit('quote:itemUpdated', {
      item: this.currentQuote.items[itemIndex],
      quote: this.currentQuote
    });
    
    // Auto save
    if (this.config.autoSave) {
      this.scheduleSave();
    }
    
    return this.currentQuote.items[itemIndex];
  }
  
  // Remove item from quote
  removeItem(itemId) {
    this.logger.debug('Removing item:', itemId);
    
    const itemIndex = this.currentQuote.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }
    
    // Remove item
    const [removedItem] = this.currentQuote.items.splice(itemIndex, 1);
    
    // Update line numbers
    this.currentQuote.items.forEach((item, index) => {
      item.lineNumber = index + 1;
    });
    
    // Update totals
    this.updateTotals();
    
    // Emit event
    this.eventBus.emit('quote:itemRemoved', {
      item: removedItem,
      quote: this.currentQuote
    });
    
    // Auto save
    if (this.config.autoSave) {
      this.scheduleSave();
    }
    
    return removedItem;
  }
  
  // Clear all items
  clearItems() {
    this.logger.debug('Clearing all items');
    
    const itemCount = this.currentQuote.items.length;
    this.currentQuote.items = [];
    
    // Update totals
    this.updateTotals();
    
    // Emit event
    this.eventBus.emit('quote:cleared', {
      itemCount,
      quote: this.currentQuote
    });
    
    // Auto save
    if (this.config.autoSave) {
      this.scheduleSave();
    }
  }
  
  // Update customer information
  updateCustomer(customerData) {
    this.logger.debug('Updating customer:', customerData);
    
    this.currentQuote.customer = {
      ...this.currentQuote.customer,
      ...customerData
    };
    
    this.currentQuote.metadata.updatedAt = new Date().toISOString();
    
    // Emit event
    this.eventBus.emit('quote:customerUpdated', {
      customer: this.currentQuote.customer,
      quote: this.currentQuote
    });
    
    // Auto save
    if (this.config.autoSave) {
      this.scheduleSave();
    }
    
    return this.currentQuote.customer;
  }
  
  // Update quote totals
  updateTotals() {
    const totals = {
      subtotal: 0,
      ltmFees: 0,
      addOns: 0,
      tax: 0,
      total: 0
    };
    
    // Calculate subtotal and fees
    this.currentQuote.items.forEach(item => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      totals.subtotal += itemTotal;
      
      if (item.ltmFee) {
        totals.ltmFees += item.ltmFee;
      }
      
      if (item.addOns) {
        Object.values(item.addOns).forEach(addon => {
          totals.addOns += addon.total || 0;
        });
      }
    });
    
    // Calculate tax if applicable
    if (this.config.taxRate) {
      totals.tax = (totals.subtotal + totals.ltmFees + totals.addOns) * this.config.taxRate;
    }
    
    // Calculate total
    totals.total = totals.subtotal + totals.ltmFees + totals.addOns + totals.tax;
    
    // Update quote
    this.currentQuote.totals = totals;
    this.currentQuote.metadata.updatedAt = new Date().toISOString();
    
    // Emit event
    this.eventBus.emit('quote:totalsUpdated', {
      totals,
      quote: this.currentQuote
    });
  }
  
  // Validate item data
  validateItem(itemData) {
    const required = ['productName', 'quantity', 'unitPrice'];
    
    for (const field of required) {
      if (!itemData[field]) {
        this.logger.error(`Missing required field: ${field}`);
        return false;
      }
    }
    
    if (itemData.quantity <= 0) {
      this.logger.error('Quantity must be greater than 0');
      return false;
    }
    
    if (itemData.unitPrice < 0) {
      this.logger.error('Unit price cannot be negative');
      return false;
    }
    
    return true;
  }
  
  // Generate unique item ID
  generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
  
  // Schedule auto save
  scheduleSave() {
    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    // Schedule new save
    this.autoSaveTimer = setTimeout(() => {
      this.saveQuote();
    }, 1000); // Save after 1 second of inactivity
  }
  
  // Save quote to storage
  saveQuote() {
    this.logger.debug('Saving quote');
    
    try {
      this.storage.set('current', this.currentQuote);
      
      // Also save to history
      const history = this.storage.get('history', []);
      const historyIndex = history.findIndex(q => q.sessionId === this.currentQuote.sessionId);
      
      if (historyIndex >= 0) {
        history[historyIndex] = this.currentQuote;
      } else {
        history.unshift(this.currentQuote);
        // Keep only last 10 quotes
        if (history.length > 10) {
          history.pop();
        }
      }
      
      this.storage.set('history', history);
      
      // Emit event
      this.eventBus.emit('quote:saved', {
        quote: this.currentQuote
      });
      
    } catch (error) {
      this.logger.error('Failed to save quote:', error);
      this.eventBus.emit('quote:saveError', {
        error,
        quote: this.currentQuote
      });
    }
  }
  
  // Load quote from storage
  loadQuote(quoteId = null) {
    this.logger.debug('Loading quote:', quoteId);
    
    try {
      let quote;
      
      if (quoteId) {
        // Load specific quote from history
        const history = this.storage.get('history', []);
        quote = history.find(q => q.id === quoteId || q.sessionId === quoteId);
      } else {
        // Load current quote
        quote = this.storage.get('current');
      }
      
      if (quote) {
        // Check expiration
        if (new Date(quote.metadata.expiresAt) < new Date()) {
          this.logger.warn('Quote has expired');
          this.eventBus.emit('quote:expired', { quote });
          return null;
        }
        
        this.currentQuote = quote;
        
        // Emit event
        this.eventBus.emit('quote:loaded', {
          quote: this.currentQuote
        });
        
        return this.currentQuote;
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Failed to load quote:', error);
      return null;
    }
  }
  
  // Get quote history
  getHistory() {
    return this.storage.get('history', []);
  }
  
  // Export quote data
  exportQuote(format = 'json') {
    const exportData = {
      quote: this.currentQuote,
      exportedAt: new Date().toISOString(),
      format
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
        
      case 'csv':
        return this.convertToCSV(exportData);
        
      case 'pdf':
        // This would require a PDF library
        this.logger.warn('PDF export not implemented');
        return null;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  // Convert quote to CSV
  convertToCSV(data) {
    const headers = ['Line', 'Product', 'Quantity', 'Unit Price', 'Total'];
    const rows = data.quote.items.map(item => [
      item.lineNumber,
      item.productName,
      item.quantity,
      item.unitPrice.toFixed(2),
      (item.quantity * item.unitPrice).toFixed(2)
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    return csv;
  }
  
  // Destroy quote system
  destroy() {
    // Clear auto save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    // Clear event listeners
    this.eventBus.clear();
    
    this.logger.debug('Quote system destroyed');
  }
}