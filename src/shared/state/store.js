// Centralized State Store
// Phase 3: State Management

import { EventBus } from '../../core/event-bus';
import { Logger } from '../../core/logger';
import { StorageManager } from '../../core/storage-manager';
import { deepClone } from '../utils';

/**
 * PricingStore - Centralized state management for all pricing pages
 */
export class PricingStore {
  constructor(options = {}) {
    this.logger = new Logger('PricingStore');
    this.eventBus = options.eventBus || new EventBus();
    this.storage = new StorageManager(options.namespace || 'pricing-store');
    
    // Initial state structure
    this.state = {
      // Product information
      product: {
        id: null,
        styleNumber: '',
        name: '',
        category: '',
        basePrice: 0,
        colors: [],
        sizes: [],
        options: {}
      },
      
      // User selections
      selections: {
        quantity: 1,
        color: null,
        colors: [], // For multi-color selection
        sizes: {},  // Size quantities
        embellishmentType: null, // embroidery, screenprint, dtg, etc.
        locations: [],
        customOptions: {}
      },
      
      // Pricing information
      pricing: {
        unitPrice: 0,
        totalPrice: 0,
        setupFees: 0,
        discount: 0,
        breakdown: {},
        matrix: null,
        lastCalculated: null
      },
      
      // Quote management
      quotes: {
        current: null,
        saved: [],
        history: []
      },
      
      // UI state
      ui: {
        loading: false,
        loadingMessage: '',
        errors: [],
        warnings: [],
        activeTab: null,
        expandedSections: [],
        modalOpen: false
      },
      
      // Feature flags
      features: {
        multiColor: false,
        sizeBreakdown: false,
        quickQuote: true,
        autoSave: true,
        priceOptimization: true
      }
    };
    
    // State history for undo/redo
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = options.maxHistorySize || 50;
    
    // Subscribers
    this.subscribers = new Map();
    
    // Middleware
    this.middleware = [];
    
    // Initialize
    this.initialize();
  }
  
  /**
   * Initialize the store
   */
  initialize() {
    // Load persisted state
    this.loadPersistedState();
    
    // Set up auto-save
    if (this.state.features.autoSave) {
      this.enableAutoSave();
    }
    
    this.logger.info('Store initialized', { state: this.state });
  }
  
  /**
   * Get current state or a specific path
   * @param {string} path - Dot notation path (e.g., 'selections.quantity')
   * @returns {any} State value
   */
  getState(path = null) {
    if (!path) {
      return deepClone(this.state);
    }
    
    const keys = path.split('.');
    let value = this.state;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return deepClone(value);
  }
  
  /**
   * Dispatch an action to update state
   * @param {string} type - Action type
   * @param {any} payload - Action payload
   */
  dispatch(type, payload = {}) {
    this.logger.debug('Dispatching action', { type, payload });
    
    // Create action object
    const action = {
      type,
      payload,
      timestamp: Date.now()
    };
    
    // Run middleware
    for (const mw of this.middleware) {
      const result = mw(action, this.state, this);
      if (result === false) {
        this.logger.warn('Action blocked by middleware', { type });
        return;
      }
    }
    
    // Save current state to history
    this.saveToHistory();
    
    // Apply action
    const previousState = deepClone(this.state);
    this.state = this.reducer(this.state, action);
    
    // Notify subscribers
    this.notifySubscribers(action, previousState);
    
    // Emit global event
    this.eventBus.emit('state:changed', {
      action,
      previousState,
      currentState: this.getState()
    });
  }
  
  /**
   * Main reducer function
   * @private
   */
  reducer(state, action) {
    const { type, payload } = action;
    
    switch (type) {
      // Product actions
      case 'SET_PRODUCT':
        return {
          ...state,
          product: {
            ...state.product,
            ...payload
          }
        };
      
      // Selection actions
      case 'UPDATE_QUANTITY':
        return {
          ...state,
          selections: {
            ...state.selections,
            quantity: Math.max(1, payload.quantity || 1)
          }
        };
      
      case 'SELECT_COLOR':
        return {
          ...state,
          selections: {
            ...state.selections,
            color: payload.color,
            colors: payload.multiSelect ? payload.colors : [payload.color]
          }
        };
      
      case 'UPDATE_SIZES':
        return {
          ...state,
          selections: {
            ...state.selections,
            sizes: payload.sizes || {}
          }
        };
      
      case 'SET_EMBELLISHMENT_TYPE':
        return {
          ...state,
          selections: {
            ...state.selections,
            embellishmentType: payload.type,
            customOptions: {} // Reset custom options when type changes
          }
        };
      
      case 'UPDATE_LOCATIONS':
        return {
          ...state,
          selections: {
            ...state.selections,
            locations: payload.locations || []
          }
        };
      
      case 'UPDATE_CUSTOM_OPTIONS':
        return {
          ...state,
          selections: {
            ...state.selections,
            customOptions: {
              ...state.selections.customOptions,
              ...payload
            }
          }
        };
      
      // Pricing actions
      case 'UPDATE_PRICING':
        return {
          ...state,
          pricing: {
            ...state.pricing,
            ...payload,
            lastCalculated: Date.now()
          }
        };
      
      case 'SET_PRICING_MATRIX':
        return {
          ...state,
          pricing: {
            ...state.pricing,
            matrix: payload.matrix
          }
        };
      
      // Quote actions
      case 'SET_CURRENT_QUOTE':
        return {
          ...state,
          quotes: {
            ...state.quotes,
            current: payload.quote
          }
        };
      
      case 'SAVE_QUOTE':
        const savedQuotes = [...state.quotes.saved];
        const existingIndex = savedQuotes.findIndex(q => q.id === payload.quote.id);
        
        if (existingIndex >= 0) {
          savedQuotes[existingIndex] = payload.quote;
        } else {
          savedQuotes.push(payload.quote);
        }
        
        return {
          ...state,
          quotes: {
            ...state.quotes,
            saved: savedQuotes,
            current: payload.quote
          }
        };
      
      case 'DELETE_QUOTE':
        return {
          ...state,
          quotes: {
            ...state.quotes,
            saved: state.quotes.saved.filter(q => q.id !== payload.quoteId)
          }
        };
      
      // UI actions
      case 'SET_LOADING':
        return {
          ...state,
          ui: {
            ...state.ui,
            loading: payload.loading,
            loadingMessage: payload.message || ''
          }
        };
      
      case 'ADD_ERROR':
        return {
          ...state,
          ui: {
            ...state.ui,
            errors: [...state.ui.errors, payload.error]
          }
        };
      
      case 'CLEAR_ERRORS':
        return {
          ...state,
          ui: {
            ...state.ui,
            errors: []
          }
        };
      
      case 'ADD_WARNING':
        return {
          ...state,
          ui: {
            ...state.ui,
            warnings: [...state.ui.warnings, payload.warning]
          }
        };
      
      case 'CLEAR_WARNINGS':
        return {
          ...state,
          ui: {
            ...state.ui,
            warnings: []
          }
        };
      
      case 'SET_ACTIVE_TAB':
        return {
          ...state,
          ui: {
            ...state.ui,
            activeTab: payload.tab
          }
        };
      
      case 'TOGGLE_SECTION':
        const expandedSections = [...state.ui.expandedSections];
        const sectionIndex = expandedSections.indexOf(payload.section);
        
        if (sectionIndex >= 0) {
          expandedSections.splice(sectionIndex, 1);
        } else {
          expandedSections.push(payload.section);
        }
        
        return {
          ...state,
          ui: {
            ...state.ui,
            expandedSections
          }
        };
      
      // Feature flags
      case 'TOGGLE_FEATURE':
        return {
          ...state,
          features: {
            ...state.features,
            [payload.feature]: !state.features[payload.feature]
          }
        };
      
      // Reset actions
      case 'RESET_SELECTIONS':
        return {
          ...state,
          selections: {
            quantity: 1,
            color: null,
            colors: [],
            sizes: {},
            embellishmentType: state.selections.embellishmentType,
            locations: [],
            customOptions: {}
          }
        };
      
      case 'RESET_ALL':
        return this.getInitialState();
      
      default:
        this.logger.warn('Unknown action type', { type });
        return state;
    }
  }
  
  /**
   * Subscribe to state changes
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback, options = {}) {
    const id = Symbol('subscriber');
    
    this.subscribers.set(id, {
      callback,
      selector: options.selector || null,
      actions: options.actions || null
    });
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(id);
    };
  }
  
  /**
   * Notify subscribers of state changes
   * @private
   */
  notifySubscribers(action, previousState) {
    this.subscribers.forEach(({ callback, selector, actions }) => {
      // Check if subscriber cares about this action
      if (actions && !actions.includes(action.type)) {
        return;
      }
      
      // Check if selected state changed
      if (selector) {
        const prevValue = this.getStateValue(previousState, selector);
        const currValue = this.getStateValue(this.state, selector);
        
        if (JSON.stringify(prevValue) === JSON.stringify(currValue)) {
          return;
        }
      }
      
      // Call subscriber
      try {
        callback(this.getState(), action);
      } catch (error) {
        this.logger.error('Subscriber error', error);
      }
    });
  }
  
  /**
   * Get value from state using dot notation
   * @private
   */
  getStateValue(state, path) {
    const keys = path.split('.');
    let value = state;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  /**
   * Add middleware
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this.middleware.push(middleware);
  }
  
  /**
   * Save current state to history
   * @private
   */
  saveToHistory() {
    // Remove any forward history
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Add current state
    this.history.push(deepClone(this.state));
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }
  
  /**
   * Undo last action
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = deepClone(this.history[this.historyIndex]);
      this.notifySubscribers({ type: 'UNDO' }, this.history[this.historyIndex + 1]);
      this.logger.info('Undo performed', { historyIndex: this.historyIndex });
    }
  }
  
  /**
   * Redo last undone action
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = deepClone(this.history[this.historyIndex]);
      this.notifySubscribers({ type: 'REDO' }, this.history[this.historyIndex - 1]);
      this.logger.info('Redo performed', { historyIndex: this.historyIndex });
    }
  }
  
  /**
   * Can undo?
   * @returns {boolean}
   */
  canUndo() {
    return this.historyIndex > 0;
  }
  
  /**
   * Can redo?
   * @returns {boolean}
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }
  
  /**
   * Enable auto-save
   * @private
   */
  enableAutoSave() {
    // Save state changes to storage
    this.subscribe(() => {
      this.saveState();
    });
    
    // Save periodically
    setInterval(() => {
      this.saveState();
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Save state to storage
   */
  saveState() {
    const stateToSave = {
      state: this.state,
      timestamp: Date.now()
    };
    
    this.storage.set('state', stateToSave);
    this.logger.debug('State saved to storage');
  }
  
  /**
   * Load persisted state
   * @private
   */
  loadPersistedState() {
    const saved = this.storage.get('state');
    
    if (saved && saved.state) {
      // Check if saved state is recent (within 24 hours)
      const age = Date.now() - saved.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        this.state = { ...this.getInitialState(), ...saved.state };
        this.logger.info('Loaded persisted state', { age: age / 1000 / 60 + ' minutes' });
      } else {
        this.logger.info('Persisted state too old, using default');
      }
    }
  }
  
  /**
   * Get initial state
   * @private
   */
  getInitialState() {
    return {
      product: {
        id: null,
        styleNumber: '',
        name: '',
        category: '',
        basePrice: 0,
        colors: [],
        sizes: [],
        options: {}
      },
      selections: {
        quantity: 1,
        color: null,
        colors: [],
        sizes: {},
        embellishmentType: null,
        locations: [],
        customOptions: {}
      },
      pricing: {
        unitPrice: 0,
        totalPrice: 0,
        setupFees: 0,
        discount: 0,
        breakdown: {},
        matrix: null,
        lastCalculated: null
      },
      quotes: {
        current: null,
        saved: [],
        history: []
      },
      ui: {
        loading: false,
        loadingMessage: '',
        errors: [],
        warnings: [],
        activeTab: null,
        expandedSections: [],
        modalOpen: false
      },
      features: {
        multiColor: false,
        sizeBreakdown: false,
        quickQuote: true,
        autoSave: true,
        priceOptimization: true
      }
    };
  }
  
  /**
   * Export state for debugging
   * @returns {Object} Current state and metadata
   */
  export() {
    return {
      state: this.getState(),
      history: this.history.length,
      historyIndex: this.historyIndex,
      subscribers: this.subscribers.size,
      middleware: this.middleware.length,
      timestamp: Date.now()
    };
  }
  
  /**
   * Import state (for debugging/testing)
   * @param {Object} data - State data to import
   */
  import(data) {
    if (data && data.state) {
      this.state = data.state;
      this.history = [deepClone(this.state)];
      this.historyIndex = 0;
      this.notifySubscribers({ type: 'IMPORT' }, {});
      this.logger.info('State imported');
    }
  }
}

// Create singleton instance
let storeInstance = null;

/**
 * Get or create store instance
 * @param {Object} options - Store options
 * @returns {PricingStore} Store instance
 */
export function getStore(options = {}) {
  if (!storeInstance) {
    storeInstance = new PricingStore(options);
  }
  return storeInstance;
}

/**
 * Reset store instance (for testing)
 */
export function resetStore() {
  storeInstance = null;
}