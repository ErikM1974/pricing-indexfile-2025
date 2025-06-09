// State Actions
// Phase 3: State Management

/**
 * Action creators for state management
 * These functions create action objects that can be dispatched to the store
 */

// Product Actions
export const productActions = {
  setProduct: (product) => ({
    type: 'SET_PRODUCT',
    payload: product
  }),
  
  updateProductOption: (optionKey, optionValue) => ({
    type: 'SET_PRODUCT',
    payload: {
      options: {
        [optionKey]: optionValue
      }
    }
  })
};

// Selection Actions
export const selectionActions = {
  updateQuantity: (quantity) => ({
    type: 'UPDATE_QUANTITY',
    payload: { quantity }
  }),
  
  selectColor: (color, multiSelect = false, colors = []) => ({
    type: 'SELECT_COLOR',
    payload: { color, multiSelect, colors }
  }),
  
  updateSizes: (sizes) => ({
    type: 'UPDATE_SIZES',
    payload: { sizes }
  }),
  
  setEmbellishmentType: (type) => ({
    type: 'SET_EMBELLISHMENT_TYPE',
    payload: { type }
  }),
  
  updateLocations: (locations) => ({
    type: 'UPDATE_LOCATIONS',
    payload: { locations }
  }),
  
  updateCustomOptions: (options) => ({
    type: 'UPDATE_CUSTOM_OPTIONS',
    payload: options
  }),
  
  resetSelections: () => ({
    type: 'RESET_SELECTIONS'
  })
};

// Pricing Actions
export const pricingActions = {
  updatePricing: (pricing) => ({
    type: 'UPDATE_PRICING',
    payload: pricing
  }),
  
  setPricingMatrix: (matrix) => ({
    type: 'SET_PRICING_MATRIX',
    payload: { matrix }
  })
};

// Quote Actions
export const quoteActions = {
  setCurrentQuote: (quote) => ({
    type: 'SET_CURRENT_QUOTE',
    payload: { quote }
  }),
  
  saveQuote: (quote) => ({
    type: 'SAVE_QUOTE',
    payload: { quote }
  }),
  
  deleteQuote: (quoteId) => ({
    type: 'DELETE_QUOTE',
    payload: { quoteId }
  })
};

// UI Actions
export const uiActions = {
  setLoading: (loading, message = '') => ({
    type: 'SET_LOADING',
    payload: { loading, message }
  }),
  
  addError: (error) => ({
    type: 'ADD_ERROR',
    payload: { error }
  }),
  
  clearErrors: () => ({
    type: 'CLEAR_ERRORS'
  }),
  
  addWarning: (warning) => ({
    type: 'ADD_WARNING',
    payload: { warning }
  }),
  
  clearWarnings: () => ({
    type: 'CLEAR_WARNINGS'
  }),
  
  setActiveTab: (tab) => ({
    type: 'SET_ACTIVE_TAB',
    payload: { tab }
  }),
  
  toggleSection: (section) => ({
    type: 'TOGGLE_SECTION',
    payload: { section }
  })
};

// Feature Actions
export const featureActions = {
  toggleFeature: (feature) => ({
    type: 'TOGGLE_FEATURE',
    payload: { feature }
  })
};

// System Actions
export const systemActions = {
  resetAll: () => ({
    type: 'RESET_ALL'
  })
};

// Composite Actions (Thunks)
// These are functions that can dispatch multiple actions

/**
 * Load product and initialize pricing
 */
export function loadProduct(productData) {
  return async (dispatch, getState, { api }) => {
    dispatch(uiActions.setLoading(true, 'Loading product...'));
    
    try {
      // Set product data
      dispatch(productActions.setProduct(productData));
      
      // Load pricing matrix
      const pricingMatrix = await api.get(`/pricing/${productData.category}`);
      dispatch(pricingActions.setPricingMatrix(pricingMatrix));
      
      // Clear any previous errors
      dispatch(uiActions.clearErrors());
      
      dispatch(uiActions.setLoading(false));
    } catch (error) {
      dispatch(uiActions.addError(error.message));
      dispatch(uiActions.setLoading(false));
    }
  };
}

/**
 * Calculate pricing based on current selections
 */
export function calculatePricing(calculator) {
  return (dispatch, getState) => {
    const state = getState();
    const { selections } = state;
    
    try {
      // Validate selections
      const validation = calculator.validateSelections(selections);
      
      if (!validation.isValid) {
        validation.errors.forEach(error => {
          dispatch(uiActions.addError(error));
        });
        return;
      }
      
      // Clear previous warnings and add new ones
      dispatch(uiActions.clearWarnings());
      validation.warnings.forEach(warning => {
        dispatch(uiActions.addWarning(warning));
      });
      
      // Calculate pricing
      const pricing = calculator.calculate(selections.quantity, selections);
      
      // Update pricing in state
      dispatch(pricingActions.updatePricing(pricing));
      
    } catch (error) {
      dispatch(uiActions.addError('Failed to calculate pricing: ' + error.message));
    }
  };
}

/**
 * Save current configuration as a quote
 */
export function saveCurrentQuote(quoteName) {
  return async (dispatch, getState, { api, generateId }) => {
    const state = getState();
    const { product, selections, pricing } = state;
    
    const quote = {
      id: generateId(),
      name: quoteName || `Quote ${new Date().toLocaleDateString()}`,
      product,
      selections,
      pricing,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    try {
      // Save to API if available
      if (api) {
        await api.post('/quotes', quote);
      }
      
      // Save to state
      dispatch(quoteActions.saveQuote(quote));
      dispatch(quoteActions.setCurrentQuote(quote));
      
    } catch (error) {
      dispatch(uiActions.addError('Failed to save quote: ' + error.message));
    }
  };
}

/**
 * Load a saved quote
 */
export function loadQuote(quoteId) {
  return async (dispatch, getState, { api }) => {
    dispatch(uiActions.setLoading(true, 'Loading quote...'));
    
    try {
      let quote;
      
      // Try to find in saved quotes first
      const state = getState();
      quote = state.quotes.saved.find(q => q.id === quoteId);
      
      // If not found, try API
      if (!quote && api) {
        quote = await api.get(`/quotes/${quoteId}`);
      }
      
      if (quote) {
        // Load product
        dispatch(productActions.setProduct(quote.product));
        
        // Load selections
        Object.entries(quote.selections).forEach(([key, value]) => {
          switch (key) {
            case 'quantity':
              dispatch(selectionActions.updateQuantity(value));
              break;
            case 'color':
              dispatch(selectionActions.selectColor(value));
              break;
            case 'sizes':
              dispatch(selectionActions.updateSizes(value));
              break;
            case 'embellishmentType':
              dispatch(selectionActions.setEmbellishmentType(value));
              break;
            case 'locations':
              dispatch(selectionActions.updateLocations(value));
              break;
            case 'customOptions':
              dispatch(selectionActions.updateCustomOptions(value));
              break;
          }
        });
        
        // Set as current quote
        dispatch(quoteActions.setCurrentQuote(quote));
        
        dispatch(uiActions.setLoading(false));
      } else {
        throw new Error('Quote not found');
      }
      
    } catch (error) {
      dispatch(uiActions.addError('Failed to load quote: ' + error.message));
      dispatch(uiActions.setLoading(false));
    }
  };
}

// Export all actions
export default {
  ...productActions,
  ...selectionActions,
  ...pricingActions,
  ...quoteActions,
  ...uiActions,
  ...featureActions,
  ...systemActions,
  // Thunks
  loadProduct,
  calculatePricing,
  saveCurrentQuote,
  loadQuote
};