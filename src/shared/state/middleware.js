// State Middleware
// Phase 3: State Management

import { Logger } from '../../core/logger';

/**
 * Logging middleware - logs all actions and state changes
 */
export const loggingMiddleware = (logger = new Logger('StateMiddleware')) => {
  return (action, state, store) => {
    const timestamp = new Date().toISOString();
    const prevState = store.getState();
    
    logger.group(`Action: ${action.type} @ ${timestamp}`);
    logger.debug('Payload:', action.payload);
    logger.debug('Previous State:', prevState);
    
    // Let action proceed
    setTimeout(() => {
      const nextState = store.getState();
      logger.debug('Next State:', nextState);
      logger.groupEnd();
    }, 0);
    
    return true;
  };
};

/**
 * Validation middleware - validates actions before they update state
 */
export const validationMiddleware = () => {
  return (action, state, store) => {
    const { type, payload } = action;
    
    switch (type) {
      case 'UPDATE_QUANTITY':
        if (!payload.quantity || payload.quantity < 1) {
          console.warn('Invalid quantity:', payload.quantity);
          return false;
        }
        break;
        
      case 'UPDATE_SIZES':
        if (!payload.sizes || typeof payload.sizes !== 'object') {
          console.warn('Invalid sizes:', payload.sizes);
          return false;
        }
        // Check that all size quantities are valid
        for (const [size, qty] of Object.entries(payload.sizes)) {
          if (qty < 0) {
            console.warn(`Invalid quantity for size ${size}:`, qty);
            return false;
          }
        }
        break;
        
      case 'UPDATE_CUSTOM_OPTIONS':
        if (!payload || typeof payload !== 'object') {
          console.warn('Invalid custom options:', payload);
          return false;
        }
        break;
    }
    
    return true;
  };
};

/**
 * Performance middleware - tracks action execution time
 */
export const performanceMiddleware = () => {
  const timings = new Map();
  
  return (action, state, store) => {
    const startTime = performance.now();
    const actionId = `${action.type}_${Date.now()}`;
    
    timings.set(actionId, startTime);
    
    // Clean up after action completes
    setTimeout(() => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (duration > 16) { // Longer than one frame (60fps)
        console.warn(`Slow action ${action.type}: ${duration.toFixed(2)}ms`);
      }
      
      timings.delete(actionId);
    }, 0);
    
    return true;
  };
};

/**
 * Analytics middleware - tracks user actions for analytics
 */
export const analyticsMiddleware = (analytics = null) => {
  return (action, state, store) => {
    // Only track user-initiated actions
    const trackedActions = [
      'UPDATE_QUANTITY',
      'SELECT_COLOR',
      'UPDATE_SIZES',
      'SET_EMBELLISHMENT_TYPE',
      'UPDATE_LOCATIONS',
      'SAVE_QUOTE',
      'LOAD_QUOTE'
    ];
    
    if (trackedActions.includes(action.type) && analytics) {
      analytics.track('pricing_action', {
        action: action.type,
        payload: action.payload,
        timestamp: Date.now()
      });
    }
    
    return true;
  };
};

/**
 * Persistence middleware - saves state changes to storage
 */
export const persistenceMiddleware = (storage, debounceMs = 1000) => {
  let saveTimeout;
  
  return (action, state, store) => {
    // Clear existing timeout
    clearTimeout(saveTimeout);
    
    // Debounce saves
    saveTimeout = setTimeout(() => {
      const stateToSave = store.getState();
      
      // Only save relevant parts of state
      const persistedState = {
        selections: stateToSave.selections,
        quotes: stateToSave.quotes,
        features: stateToSave.features
      };
      
      storage.set('persistedState', {
        state: persistedState,
        timestamp: Date.now()
      });
    }, debounceMs);
    
    return true;
  };
};

/**
 * Undo/Redo middleware - manages state history
 */
export const historyMiddleware = (maxHistorySize = 50) => {
  const history = [];
  let currentIndex = -1;
  
  return (action, state, store) => {
    // Don't track certain actions in history
    const ignoredActions = [
      'SET_LOADING',
      'ADD_ERROR',
      'CLEAR_ERRORS',
      'ADD_WARNING',
      'CLEAR_WARNINGS',
      'UNDO',
      'REDO'
    ];
    
    if (ignoredActions.includes(action.type)) {
      return true;
    }
    
    // Add to history
    const newState = store.getState();
    
    // Remove any forward history
    history.splice(currentIndex + 1);
    
    // Add new state
    history.push({
      action,
      state: newState,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (history.length > maxHistorySize) {
      history.shift();
    } else {
      currentIndex++;
    }
    
    // Add undo/redo methods to store if not present
    if (!store.undo) {
      store.undo = () => {
        if (currentIndex > 0) {
          currentIndex--;
          const { state: previousState } = history[currentIndex];
          store.import({ state: previousState });
        }
      };
      
      store.redo = () => {
        if (currentIndex < history.length - 1) {
          currentIndex++;
          const { state: nextState } = history[currentIndex];
          store.import({ state: nextState });
        }
      };
      
      store.canUndo = () => currentIndex > 0;
      store.canRedo = () => currentIndex < history.length - 1;
    }
    
    return true;
  };
};

/**
 * Feature flag middleware - controls feature availability
 */
export const featureFlagMiddleware = (flags = {}) => {
  return (action, state, store) => {
    const { type, payload } = action;
    
    // Check feature flags for certain actions
    switch (type) {
      case 'SELECT_COLOR':
        if (payload.multiSelect && !flags.multiColorSelection) {
          console.warn('Multi-color selection is not enabled');
          return false;
        }
        break;
        
      case 'UPDATE_SIZES':
        if (!flags.sizeBreakdown) {
          console.warn('Size breakdown is not enabled');
          return false;
        }
        break;
    }
    
    return true;
  };
};

/**
 * Create middleware stack
 * @param {Object} options - Middleware options
 * @returns {Array} Array of middleware functions
 */
export function createMiddlewareStack(options = {}) {
  const stack = [];
  
  // Always add validation
  stack.push(validationMiddleware());
  
  // Add optional middleware
  if (options.logging) {
    stack.push(loggingMiddleware(options.logger));
  }
  
  if (options.performance) {
    stack.push(performanceMiddleware());
  }
  
  if (options.analytics) {
    stack.push(analyticsMiddleware(options.analytics));
  }
  
  if (options.persistence && options.storage) {
    stack.push(persistenceMiddleware(options.storage, options.persistenceDebounce));
  }
  
  if (options.history) {
    stack.push(historyMiddleware(options.maxHistorySize));
  }
  
  if (options.featureFlags) {
    stack.push(featureFlagMiddleware(options.featureFlags));
  }
  
  return stack;
}