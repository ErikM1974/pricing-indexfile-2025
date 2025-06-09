// State Selectors
// Phase 3: State Management

/**
 * Selectors for deriving computed values from state
 * These functions provide efficient access to state values and computed data
 */

// Product Selectors
export const productSelectors = {
  getProduct: (state) => state.product,
  
  getProductId: (state) => state.product.id,
  
  getProductName: (state) => state.product.name,
  
  getProductCategory: (state) => state.product.category,
  
  getAvailableColors: (state) => state.product.colors || [],
  
  getAvailableSizes: (state) => state.product.sizes || [],
  
  getProductOptions: (state) => state.product.options || {},
  
  hasProductData: (state) => !!(state.product.id && state.product.name)
};

// Selection Selectors
export const selectionSelectors = {
  getSelections: (state) => state.selections,
  
  getQuantity: (state) => state.selections.quantity,
  
  getSelectedColor: (state) => state.selections.color,
  
  getSelectedColors: (state) => state.selections.colors || [],
  
  getSizeBreakdown: (state) => state.selections.sizes || {},
  
  getTotalQuantity: (state) => {
    const sizes = state.selections.sizes || {};
    return Object.values(sizes).reduce((total, qty) => total + qty, 0) || state.selections.quantity;
  },
  
  getEmbellishmentType: (state) => state.selections.embellishmentType,
  
  getLocations: (state) => state.selections.locations || [],
  
  getLocationCount: (state) => (state.selections.locations || []).length,
  
  getCustomOptions: (state) => state.selections.customOptions || {},
  
  hasValidSelections: (state) => {
    const { quantity, embellishmentType } = state.selections;
    return quantity > 0 && !!embellishmentType;
  },
  
  // Cap embroidery specific
  getStitchCounts: (state) => state.selections.customOptions?.stitchCounts || {},
  
  getTotalStitchCount: (state) => {
    const stitchCounts = state.selections.customOptions?.stitchCounts || {};
    return Object.values(stitchCounts).reduce((total, count) => total + count, 0);
  },
  
  // Screen print specific
  getColorCount: (state) => state.selections.customOptions?.colorCount || 1,
  
  getScreenCount: (state) => state.selections.customOptions?.screenCount || 1,
  
  // DTG specific
  getPrintSize: (state) => state.selections.customOptions?.printSize || 'standard',
  
  // DTF specific
  getTransferSize: (state) => state.selections.customOptions?.transferSize || 'medium'
};

// Pricing Selectors
export const pricingSelectors = {
  getPricing: (state) => state.pricing,
  
  getUnitPrice: (state) => state.pricing.unitPrice,
  
  getTotalPrice: (state) => state.pricing.totalPrice,
  
  getSetupFees: (state) => state.pricing.setupFees,
  
  getDiscount: (state) => state.pricing.discount,
  
  getDiscountPercentage: (state) => {
    const { totalPrice, discount } = state.pricing;
    if (!totalPrice || !discount) return 0;
    return Math.round((discount / (totalPrice + discount)) * 100);
  },
  
  getPriceBreakdown: (state) => state.pricing.breakdown || {},
  
  getPricingMatrix: (state) => state.pricing.matrix,
  
  getLastCalculatedTime: (state) => state.pricing.lastCalculated,
  
  isPriceStale: (state) => {
    const lastCalculated = state.pricing.lastCalculated;
    if (!lastCalculated) return true;
    
    // Consider price stale after 5 minutes
    const staleTime = 5 * 60 * 1000;
    return Date.now() - lastCalculated > staleTime;
  },
  
  getSavingsMessage: (state) => state.pricing.breakdown?.savingsMessage || null
};

// Quote Selectors
export const quoteSelectors = {
  getCurrentQuote: (state) => state.quotes.current,
  
  getSavedQuotes: (state) => state.quotes.saved || [],
  
  getQuoteById: (state, quoteId) => {
    return state.quotes.saved.find(q => q.id === quoteId);
  },
  
  getQuoteCount: (state) => (state.quotes.saved || []).length,
  
  getRecentQuotes: (state, limit = 5) => {
    return [...(state.quotes.saved || [])]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  },
  
  hasUnsavedChanges: (state) => {
    const current = state.quotes.current;
    if (!current) return false;
    
    // Compare current state with saved quote
    const currentData = JSON.stringify({
      selections: state.selections,
      pricing: state.pricing
    });
    
    const savedData = JSON.stringify({
      selections: current.selections,
      pricing: current.pricing
    });
    
    return currentData !== savedData;
  }
};

// UI Selectors
export const uiSelectors = {
  isLoading: (state) => state.ui.loading,
  
  getLoadingMessage: (state) => state.ui.loadingMessage,
  
  getErrors: (state) => state.ui.errors || [],
  
  hasErrors: (state) => (state.ui.errors || []).length > 0,
  
  getWarnings: (state) => state.ui.warnings || [],
  
  hasWarnings: (state) => (state.ui.warnings || []).length > 0,
  
  getActiveTab: (state) => state.ui.activeTab,
  
  getExpandedSections: (state) => state.ui.expandedSections || [],
  
  isSectionExpanded: (state, section) => {
    return (state.ui.expandedSections || []).includes(section);
  },
  
  isModalOpen: (state) => state.ui.modalOpen
};

// Feature Selectors
export const featureSelectors = {
  getFeatures: (state) => state.features,
  
  isFeatureEnabled: (state, feature) => {
    return !!state.features[feature];
  },
  
  isMultiColorEnabled: (state) => state.features.multiColor,
  
  isSizeBreakdownEnabled: (state) => state.features.sizeBreakdown,
  
  isQuickQuoteEnabled: (state) => state.features.quickQuote,
  
  isAutoSaveEnabled: (state) => state.features.autoSave,
  
  isPriceOptimizationEnabled: (state) => state.features.priceOptimization
};

// Composite Selectors
export const compositeSelectors = {
  /**
   * Get complete quote data for saving
   */
  getQuoteData: (state) => {
    return {
      product: productSelectors.getProduct(state),
      selections: selectionSelectors.getSelections(state),
      pricing: pricingSelectors.getPricing(state),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };
  },
  
  /**
   * Get pricing summary for display
   */
  getPricingSummary: (state) => {
    const quantity = selectionSelectors.getTotalQuantity(state);
    const unitPrice = pricingSelectors.getUnitPrice(state);
    const totalPrice = pricingSelectors.getTotalPrice(state);
    const setupFees = pricingSelectors.getSetupFees(state);
    const discount = pricingSelectors.getDiscount(state);
    
    return {
      quantity,
      unitPrice,
      subtotal: quantity * unitPrice,
      setupFees,
      discount,
      totalPrice
    };
  },
  
  /**
   * Get validation status
   */
  getValidationStatus: (state) => {
    const errors = uiSelectors.getErrors(state);
    const warnings = uiSelectors.getWarnings(state);
    const hasValidSelections = selectionSelectors.hasValidSelections(state);
    
    return {
      isValid: errors.length === 0 && hasValidSelections,
      errors,
      warnings
    };
  },
  
  /**
   * Get ready state for pricing calculation
   */
  isReadyToCalculate: (state) => {
    const hasProduct = productSelectors.hasProductData(state);
    const hasSelections = selectionSelectors.hasValidSelections(state);
    const isLoading = uiSelectors.isLoading(state);
    
    return hasProduct && hasSelections && !isLoading;
  },
  
  /**
   * Get embroidery specific data
   */
  getEmbroideryData: (state) => {
    if (selectionSelectors.getEmbellishmentType(state) !== 'embroidery') {
      return null;
    }
    
    return {
      locations: selectionSelectors.getLocations(state),
      stitchCounts: selectionSelectors.getStitchCounts(state),
      totalStitches: selectionSelectors.getTotalStitchCount(state),
      locationCount: selectionSelectors.getLocationCount(state)
    };
  },
  
  /**
   * Get screen print specific data
   */
  getScreenPrintData: (state) => {
    if (selectionSelectors.getEmbellishmentType(state) !== 'screenprint') {
      return null;
    }
    
    return {
      locations: selectionSelectors.getLocations(state),
      colorCount: selectionSelectors.getColorCount(state),
      screenCount: selectionSelectors.getScreenCount(state)
    };
  }
};

// Create memoized selectors for expensive computations
const memoize = (fn) => {
  const cache = new Map();
  
  return (...args) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Clear cache if it gets too large
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
};

// Export memoized versions of expensive selectors
export const memoizedSelectors = {
  getTotalQuantity: memoize(selectionSelectors.getTotalQuantity),
  getTotalStitchCount: memoize(selectionSelectors.getTotalStitchCount),
  getPricingSummary: memoize(compositeSelectors.getPricingSummary),
  getValidationStatus: memoize(compositeSelectors.getValidationStatus)
};

// Export all selectors
export default {
  ...productSelectors,
  ...selectionSelectors,
  ...pricingSelectors,
  ...quoteSelectors,
  ...uiSelectors,
  ...featureSelectors,
  ...compositeSelectors,
  ...memoizedSelectors
};