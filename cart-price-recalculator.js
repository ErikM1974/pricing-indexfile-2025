/**
 * Cart Price Recalculator
 * Recalculates prices in the cart based on total quantity for the same embellishment type
 */

(function() {
  "use strict";

  // Configuration
  const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
  const STORAGE_KEYS = {
    sessionId: 'nwca_cart_session_id',
    cartItems: 'nwca_cart_items'
  };
  
  // Enable debugging in development environments
  const DEBUG = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.hostname.includes('dev.') || 
                window.location.hostname.includes('staging.') || 
                window.location.search.includes('debug=true');

  // Debugging utility
  function debugLog(area, ...args) {
    if (DEBUG) console.log(`[PRICE-RECALC:${area}]`, ...args);
  }

  /**
   * Recalculates prices for all items with the same embellishment type
   * @param {string} embellishmentType - The type of embellishment
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function recalculatePricesForEmbellishmentType(embellishmentType) {
    try {
      debugLog("RECALC", `Starting recalculation for ${embellishmentType}`);
      
      // Get the current session ID
      const sessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
      if (!sessionId) {
        debugLog("RECALC-ERROR", "No session ID found in localStorage");
        return false;
      }
      
      // Get cart items from the API
      const response = await fetch(`${API_BASE_URL}/cart-items?sessionID=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        const errorText = await response.text();
        debugLog("RECALC-ERROR", `API error getting cart items: ${response.status} ${response.statusText}`, errorText);
        return false;
      }
      
      const cartItems = await response.json();
      debugLog("RECALC", `Retrieved ${cartItems.length} cart items`);
      
      // Filter items by embellishment type and active status
      const items = cartItems.filter(item => 
        item.ImprintType === embellishmentType && item.CartStatus === 'Active'
      );
      
      if (items.length === 0) {
        debugLog("RECALC", `No active items found for embellishment type: ${embellishmentType}`);
        return true; // Nothing to recalculate
      }
      
      debugLog("RECALC", `Found ${items.length} items with embellishment type: ${embellishmentType}`);
      
      // Get all cart item sizes for these items
      const sizePromises = items.map(item => 
        fetch(`${API_BASE_URL}/cart-item-sizes?cartItemID=${encodeURIComponent(item.CartItemID)}`)
          .then(res => res.ok ? res.json() : [])
      );
      
      const sizeResults = await Promise.all(sizePromises);
      const allSizes = sizeResults.flat();
      
      debugLog("RECALC", `Retrieved ${allSizes.length} sizes for all items`);
      
      // Calculate total quantity
      const totalQuantity = allSizes.reduce((sum, size) => sum + (parseInt(size.Quantity) || 0), 0);
      debugLog("RECALC", `Total quantity for ${embellishmentType}: ${totalQuantity}`);
      
      if (totalQuantity === 0) {
        debugLog("RECALC", "Total quantity is 0, nothing to recalculate");
        return true;
      }
      
      // Get pricing matrix from API
      const matrixResponse = await fetch(`${API_BASE_URL}/pricing-matrix?embellishmentType=${encodeURIComponent(embellishmentType)}&sessionID=${encodeURIComponent(sessionId)}`);
      
      if (!matrixResponse.ok) {
        debugLog("RECALC-ERROR", `Failed to get pricing matrix: ${matrixResponse.status}`);
        return false;
      }
      
      const pricingMatrices = await matrixResponse.json();
      
      if (!pricingMatrices || pricingMatrices.length === 0) {
        debugLog("RECALC-WARN", `No pricing matrix found for ${embellishmentType}`);
        return false;
      }
      
      // Use the most recent pricing matrix
      const pricingMatrix = pricingMatrices[0];
      debugLog("RECALC", "Found pricing matrix:", pricingMatrix.PricingMatrixID);
      
      // Parse tier structure
      const tierStructure = JSON.parse(pricingMatrix.TierStructure);
      const sizeGroups = JSON.parse(pricingMatrix.SizeGroups);
      const priceMatrix = JSON.parse(pricingMatrix.PriceMatrix);
      
      // Find the appropriate tier for the total quantity
      let applicableTier = null;
      
      for (const tierLabel in tierStructure) {
        const tier = tierStructure[tierLabel];
        if (totalQuantity >= tier.MinQuantity && 
            (!tier.MaxQuantity || totalQuantity <= tier.MaxQuantity)) {
          applicableTier = tierLabel;
          break;
        }
      }
      
      if (!applicableTier) {
        debugLog("RECALC-WARN", `No applicable tier found for quantity ${totalQuantity}`);
        return false;
      }
      
      debugLog("RECALC", `Using tier ${applicableTier} for quantity ${totalQuantity}`);
      
      // Update prices for all sizes
      let updateCount = 0;
      const updatePromises = [];
      
      for (const size of allSizes) {
        // Skip sizes with quantity 0
        if (parseInt(size.Quantity) === 0) continue;
        
        // Find the size group for this size
        let sizeGroup = findSizeGroup(size.Size, sizeGroups);
        
        if (!sizeGroup) {
          debugLog("RECALC-WARN", `No size group found for size ${size.Size}`);
          continue;
        }
        
        // Get the price for this size group and tier
        const price = priceMatrix[sizeGroup] ? priceMatrix[sizeGroup][applicableTier] : null;
        
        if (price === null || price === undefined) {
          debugLog("RECALC-WARN", `No price found for size group ${sizeGroup}, tier ${applicableTier}`);
          continue;
        }
        
        // Only update if the price is different
        if (parseFloat(size.UnitPrice) !== parseFloat(price)) {
          debugLog("RECALC", `Updating price for size ${size.Size} from $${size.UnitPrice} to $${price}`);
          
          // Update the price on the server
          updatePromises.push(
            fetch(`${API_BASE_URL}/cart-item-sizes/${size.SizeItemID}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                CartItemID: size.CartItemID,
                Size: size.Size,
                Quantity: size.Quantity,
                UnitPrice: price
              })
            }).then(res => {
              if (res.ok) updateCount++;
              return res.ok;
            }).catch(error => {
              debugLog("RECALC-ERROR", `Error updating price for size ${size.Size}:`, error);
              return false;
            })
          );
        }
      }
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      debugLog("RECALC-SUCCESS", `Updated ${updateCount} prices for ${embellishmentType}`);
      
      // Trigger cart update event if available
      if (typeof window.NWCACart !== 'undefined' && typeof window.NWCACart.syncWithServer === 'function') {
        debugLog("RECALC", "Triggering cart sync with server");
        await window.NWCACart.syncWithServer();
      }
      
      return true;
    } catch (error) {
      debugLog("RECALC-ERROR", "Error recalculating prices:", error);
      return false;
    }
  }

  /**
   * Helper function to find the size group for a given size
   * @param {string} size - The size to find a group for
   * @param {Array} sizeGroups - The available size groups
   * @returns {string|null} - The size group or null if not found
   */
  function findSizeGroup(size, sizeGroups) {
    if (!size || !sizeGroups || !Array.isArray(sizeGroups)) return null;
    
    const upperSize = size.toUpperCase();
    
    // First try direct match
    for (const group of sizeGroups) {
      if (group.toUpperCase() === upperSize) {
        return group;
      }
    }
    
    // Then try range match (e.g., "S-XL")
    for (const group of sizeGroups) {
      if (group.includes('-')) {
        const [start, end] = group.split('-').map(s => s.trim().toUpperCase());
        // Basic alphabetical check - might need refinement for non-standard sizes
        if (upperSize >= start && upperSize <= end) {
          return group;
        }
      }
    }
    
    // Special case for common size mappings
    const sizeMap = {
      'SMALL': 'S',
      'MEDIUM': 'M',
      'LARGE': 'L',
      'XLARGE': 'XL',
      'X-LARGE': 'XL',
      '2XLARGE': '2XL',
      '2X-LARGE': '2XL',
      '3XLARGE': '3XL',
      '3X-LARGE': '3XL',
      '4XLARGE': '4XL',
      '4X-LARGE': '4XL'
    };
    
    // Try mapped size
    const mappedSize = sizeMap[upperSize];
    if (mappedSize) {
      for (const group of sizeGroups) {
        if (group.toUpperCase() === mappedSize) {
          return group;
        }
        
        if (group.includes('-')) {
          const [start, end] = group.split('-').map(s => s.trim().toUpperCase());
          if (mappedSize >= start && mappedSize <= end) {
            return group;
          }
        }
      }
    }
    
    // If all else fails, try to find a default group
    for (const group of sizeGroups) {
      if (group.toUpperCase().includes('DEFAULT') || group.toUpperCase().includes('STANDARD')) {
        return group;
      }
    }
    
    return null;
  }

  // Expose the recalculate function globally
  window.recalculatePricesForEmbellishmentType = recalculatePricesForEmbellishmentType;
  
  // Listen for cart update events
  window.addEventListener('cartItemAdded', async (event) => {
    if (event.detail && event.detail.embellishmentType) {
      debugLog("EVENT", "Cart item added event received", event.detail);
      await recalculatePricesForEmbellishmentType(event.detail.embellishmentType);
    }
  });
  
  debugLog("LOAD", "Cart price recalculator loaded");
})();