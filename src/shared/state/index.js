// State Management Module
// Phase 3: State Management

import { PricingStore, getStore, resetStore } from './store';
import actions from './actions';
import selectors from './selectors';
import { createMiddlewareStack } from './middleware';

/**
 * Initialize the global store with middleware
 * @param {Object} options - Store configuration options
 * @returns {Object} Store instance and helpers
 */
export function initializeStore(options = {}) {
  // Get or create store instance
  const store = getStore(options);
  
  // Create and apply middleware stack
  const middleware = createMiddlewareStack({
    logging: options.debug || false,
    performance: options.performance || false,
    analytics: options.analytics || null,
    persistence: options.persistence !== false,
    storage: options.storage || store.storage,
    history: options.history !== false,
    featureFlags: options.featureFlags || {},
    logger: options.logger
  });
  
  // Apply middleware to store
  middleware.forEach(mw => store.use(mw));
  
  // Create bound action creators
  const boundActions = {};
  Object.entries(actions).forEach(([name, actionCreator]) => {
    if (typeof actionCreator === 'function') {
      // Check if it's a thunk (returns a function)
      boundActions[name] = (...args) => {
        const action = actionCreator(...args);
        
        if (typeof action === 'function') {
          // It's a thunk, call it with dispatch, getState, and extras
          return action(
            (a) => store.dispatch(a.type, a.payload),
            () => store.getState(),
            {
              api: options.api,
              generateId: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          );
        } else {
          // Regular action, dispatch it
          store.dispatch(action.type, action.payload);
        }
      };
    }
  });
  
  // Create selector functions bound to current state
  const select = (selectorFn, ...args) => {
    const state = store.getState();
    return selectorFn(state, ...args);
  };
  
  // Helper to create state hooks for React/Vue
  const createStateHook = (selectorFn, equalityFn) => {
    let currentValue = selectorFn(store.getState());
    const listeners = new Set();
    
    // Subscribe to store changes
    store.subscribe((state) => {
      const newValue = selectorFn(state);
      
      // Check if value changed
      const hasChanged = equalityFn
        ? !equalityFn(currentValue, newValue)
        : currentValue !== newValue;
      
      if (hasChanged) {
        currentValue = newValue;
        listeners.forEach(listener => listener(newValue));
      }
    });
    
    return {
      getValue: () => currentValue,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
  };
  
  return {
    // Store instance
    store,
    
    // Bound actions
    actions: boundActions,
    
    // Selectors
    selectors,
    select,
    
    // State hooks
    createStateHook,
    
    // Utilities
    getState: () => store.getState(),
    subscribe: (callback, options) => store.subscribe(callback, options),
    dispatch: (type, payload) => store.dispatch(type, payload),
    
    // History management
    undo: () => store.undo(),
    redo: () => store.redo(),
    canUndo: () => store.canUndo(),
    canRedo: () => store.canRedo(),
    
    // Debugging
    export: () => store.export(),
    import: (data) => store.import(data),
    reset: () => store.dispatch('RESET_ALL')
  };
}

// Export individual modules
export { PricingStore, getStore, resetStore } from './store';
export { default as actions } from './actions';
export { default as selectors } from './selectors';
export * from './middleware';

// Create and export default store instance
let defaultStore = null;

export function getDefaultStore(options = {}) {
  if (!defaultStore) {
    defaultStore = initializeStore(options);
  }
  return defaultStore;
}

export default getDefaultStore;