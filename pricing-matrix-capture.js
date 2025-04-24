/**
 * Pricing Matrix Capture System
 * Captures pricing matrix data when it loads from Caspio and stores it in the PricingMatrix table
 */

(function() {
  "use strict";

  // Configuration
  const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
  const STORAGE_KEYS = {
    sessionId: 'nwca_cart_session_id'
  };
  
  // Enable debugging in development environments
  const DEBUG = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.hostname.includes('dev.') || 
                window.location.hostname.includes('staging.') || 
                window.location.search.includes('debug=true');

  // Debugging utility
  function debugLog(area, ...args) {
    if (DEBUG) console.log(`[PRICING-MATRIX:${area}]`, ...args);
  }

  /**
   * Captures the pricing matrix data and sends it to the API
   * @param {string} styleNumber - The product style number
   * @param {string} color - The product color
   * @param {string} embellishmentType - The type of embellishment
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function capturePricingMatrix(styleNumber, color, embellishmentType) {
    try {
      debugLog("CAPTURE", `Starting capture for ${styleNumber}, ${color}, ${embellishmentType}`);
      
      // Get the current session ID
      const sessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
      if (!sessionId) {
        debugLog("CAPTURE-ERROR", "No session ID found in localStorage");
        return false;
      }
      
      // Get the pricing data from global variables
      const tierStructure = window.dp5ApiTierData || {};
      const sizeGroups = window.dp5GroupedHeaders || [];
      const priceMatrix = window.dp5GroupedPrices || {};
      
      debugLog("CAPTURE", "Pricing data found:", {
        tierStructure: Object.keys(tierStructure).length > 0,
        sizeGroups: sizeGroups.length > 0,
        priceMatrix: Object.keys(priceMatrix).length > 0
      });
      
      // Validate that we have pricing data
      if (Object.keys(tierStructure).length === 0 || 
          sizeGroups.length === 0 || 
          Object.keys(priceMatrix).length === 0) {
        debugLog("CAPTURE-ERROR", "Missing pricing data components");
        return false;
      }
      
      // Prepare the data for the API
      const pricingData = {
        SessionID: sessionId,
        StyleNumber: styleNumber,
        Color: color,
        EmbellishmentType: embellishmentType,
        TierStructure: JSON.stringify(tierStructure),
        SizeGroups: JSON.stringify(sizeGroups),
        PriceMatrix: JSON.stringify(priceMatrix)
      };
      
      debugLog("CAPTURE", "Sending data to API:", pricingData);
      
      // Send the data to the API
      const response = await fetch(`${API_BASE_URL}/pricing-matrix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pricingData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        debugLog("CAPTURE-ERROR", `API error: ${response.status} ${response.statusText}`, errorText);
        return false;
      }
      
      const result = await response.json();
      debugLog("CAPTURE-SUCCESS", "Pricing matrix captured and stored successfully", result);
      return true;
    } catch (error) {
      debugLog("CAPTURE-ERROR", "Error capturing pricing matrix:", error);
      return false;
    }
  }

  /**
   * Initializes the pricing matrix capture system
   */
  function initPricingMatrixCapture() {
    debugLog("INIT", "Initializing pricing matrix capture system");
    
    // Listen for the custom event that signals pricing data is loaded
    window.addEventListener('pricingDataLoaded', async (event) => {
      debugLog("EVENT", "Pricing data loaded event received", event.detail);
      
      const { styleNumber, color, embellishmentType } = event.detail;
      await capturePricingMatrix(styleNumber, color, embellishmentType);
    });
    
    // Also check periodically for pricing data
    const checkInterval = setInterval(() => {
      if (window.dp5ApiTierData && window.dp5GroupedHeaders && window.dp5GroupedPrices) {
        debugLog("CHECK", "Pricing data found during interval check");
        
        // Get data from URL or global variables
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber') || window.selectedStyleNumber;
        const color = window.selectedCatalogColor || window.selectedColorName;
        const embType = getEmbellishmentTypeFromUrl();
        
        if (styleNumber && color && embType) {
          capturePricingMatrix(styleNumber, color, embType);
          clearInterval(checkInterval);
        }
      }
    }, 2000);
  }

  /**
   * Helper function to get the embellishment type from the URL path
   * @returns {string} The embellishment type
   */
  function getEmbellishmentTypeFromUrl() {
    const currentPage = window.location.pathname.toLowerCase();
    if (currentPage.includes('cap-embroidery')) return 'cap-embroidery';
    if (currentPage.includes('embroidery')) return 'embroidery';
    if (currentPage.includes('dtg')) return 'dtg';
    if (currentPage.includes('screenprint') || currentPage.includes('screen-print')) return 'screenprint';
    if (currentPage.includes('dtf')) return 'dtf';
    return 'unknown';
  }

  // Initialize when the DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPricingMatrixCapture);
  } else {
    initPricingMatrixCapture();
  }

  // Expose the capture function globally
  window.capturePricingMatrix = capturePricingMatrix;
  
  debugLog("LOAD", "Pricing matrix capture system loaded");
})();