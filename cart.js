// cart.js - Client-side shopping cart implementation

/**
 * Shopping Cart Module for Northwest Custom Apparel
 * Handles cart operations and synchronization with Caspio database
 */
const NWCACart = (function() {
  // API endpoints
  const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
  const ENDPOINTS = {
    cartSessions: {
      getAll: `${API_BASE_URL}/cart-sessions`,
      getById: (id) => `${API_BASE_URL}/cart-sessions?sessionID=${id}`,
      create: `${API_BASE_URL}/cart-sessions`,
      update: (id) => `${API_BASE_URL}/cart-sessions/${id}`,
      delete: (id) => `${API_BASE_URL}/cart-sessions/${id}`
    },
    cartItems: {
      getAll: `${API_BASE_URL}/cart-items`,
      getBySession: (sessionId) => `${API_BASE_URL}/cart-items?sessionID=${sessionId}`,
      create: `${API_BASE_URL}/cart-items`,
      update: (id) => `${API_BASE_URL}/cart-items/${id}`,
      delete: (id) => `${API_BASE_URL}/cart-items/${id}`
    },
    cartItemSizes: {
      getAll: `${API_BASE_URL}/cart-item-sizes`,
      getByCartItem: (cartItemId) => `${API_BASE_URL}/cart-item-sizes?cartItemID=${cartItemId}`,
      create: `${API_BASE_URL}/cart-item-sizes`,
      update: (id) => `${API_BASE_URL}/cart-item-sizes/${id}`,
      delete: (id) => `${API_BASE_URL}/cart-item-sizes/${id}`
    },
    inventory: {
      getByStyleAndColor: (styleNumber, color) =>
        `${API_BASE_URL}/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`
    }
  };

  // Local storage keys
  const STORAGE_KEYS = {
    sessionId: 'nwca_cart_session_id',
    cartItems: 'nwca_cart_items',
    lastSync: 'nwca_cart_last_sync'
  };

  // Cart state
  let cartState = {
    sessionId: null,
    items: [],
    loading: true,
    error: null,
    lastSync: null
  };

  // Event listeners
  const eventListeners = {
    cartUpdated: []
  };

  /**
   * Initialize the cart
   * @returns {Promise<void>}
   */
  async function initializeCart() {
    try {
      cartState.loading = true;
      
      // Load items from localStorage first
      loadFromLocalStorage();
      
      // Check if we have a session ID in localStorage
      const storedSessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
      
      if (storedSessionId) {
        try {
          // Try to get the session from the API
          const response = await fetch(ENDPOINTS.cartSessions.getById(storedSessionId));
          
          if (response.ok) {
            const sessions = await response.json();
            
            // Check if we got any sessions back and if the first one is active
            if (sessions && sessions.length > 0 && sessions[0].IsActive) {
              cartState.sessionId = storedSessionId;
              await loadCartItems();
            } else {
              // Session is no longer active, create a new one
              await createLocalSession();
            }
          } else {
            // Session not found or other error, create a new one
            await createLocalSession();
          }
        } catch (error) {
          console.error('Error retrieving session:', error);
          await createLocalSession();
        }
      } else {
        // No stored session ID, create a new one
        await createLocalSession();
      }
      
      // Try to sync with server (this will update the localStorage if needed)
      try {
        await syncWithServer();
      } catch (error) {
        console.warn('Could not sync with server, using local storage only:', error);
      }
      
      cartState.loading = false;
      triggerEvent('cartUpdated');
    } catch (error) {
      console.error('Error initializing cart:', error);
      cartState.error = 'Failed to initialize cart';
      cartState.loading = false;
      triggerEvent('cartUpdated');
    }
  }

  /**
   * Create a new cart session
   * @returns {Promise<void>}
   */
  /**
   * Create a new session locally without API
   * @returns {Promise<string>}
   */
  async function createLocalSession() {
    try {
      // Generate a random session ID
      const sessionId = 'local_' + Math.random().toString(36).substring(2, 15) +
                        Math.random().toString(36).substring(2, 15);
      
      cartState.sessionId = sessionId;
      localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
      
      // Initialize empty cart if not already loaded
      if (!cartState.items || !Array.isArray(cartState.items)) {
        cartState.items = [];
      }
      
      saveToLocalStorage();
      console.log('Created local session:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('Error creating local session:', error);
      cartState.error = 'Unable to create a shopping cart session';
      throw error;
    }
  }

  /**
   * Create a new cart session via API
   * @returns {Promise<string>}
   */
  async function createNewSession() {
    try {
      const userAgent = navigator.userAgent;
      
      const sessionData = {
        SessionID: 'sess_' + Math.random().toString(36).substring(2, 10),
        CreateDate: new Date().toISOString(),
        LastActivity: new Date().toISOString(),
        UserAgent: userAgent,
        IPAddress: '', // This will be set by the server
        IsActive: true
      };
      
      try {
        const response = await fetch(ENDPOINTS.cartSessions.create, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sessionData)
        });
        
        if (response.ok) {
          const newSession = await response.json();
          cartState.sessionId = newSession.SessionID || sessionData.SessionID;
          localStorage.setItem(STORAGE_KEYS.sessionId, cartState.sessionId);
          cartState.items = [];
          saveToLocalStorage();
          return cartState.sessionId;
        } else {
          throw new Error('Failed to create a new session');
        }
      } catch (apiError) {
        console.error('API error creating session, falling back to local session:', apiError);
        return await createLocalSession();
      }
    } catch (error) {
      console.error('Error creating new session:', error);
      cartState.error = 'Unable to create a shopping cart session';
      throw error;
    }
  }

  /**
   * Load cart items from the server
   * @returns {Promise<void>}
   */
  async function loadCartItems() {
    if (!cartState.sessionId) return;
    
    // If this is a local session, just use localStorage
    if (cartState.sessionId.startsWith('local_')) {
      console.log('Using local session, skipping API call for cart items');
      return;
    }
    
    try {
      // Show loading state
      cartState.loading = true;
      triggerEvent('cartUpdated');
      
      try {
        const response = await fetch(ENDPOINTS.cartItems.getBySession(cartState.sessionId));
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load cart items: ${response.status} ${errorText}`);
        }
        
        // The API returns items for the session
        const items = await response.json();
        
        if (!items || !Array.isArray(items)) {
          console.warn('API returned non-array items:', items);
          return;
        }
        
        // For each item, get its sizes
        const itemsWithSizes = await Promise.all(items.map(async (item) => {
          try {
            const sizesResponse = await fetch(ENDPOINTS.cartItemSizes.getByCartItem(item.CartItemID));
            
            if (sizesResponse.ok) {
              const sizes = await sizesResponse.json();
              return {
                ...item,
                sizes: Array.isArray(sizes) ? sizes : []
              };
            }
            
            return {
              ...item,
              sizes: []
            };
          } catch (sizeError) {
            console.error(`Error fetching sizes for item ${item.CartItemID}:`, sizeError);
            return {
              ...item,
              sizes: []
            };
          }
        }));
        
        cartState.items = itemsWithSizes;
        cartState.error = null;
        
        // Save to localStorage
        saveToLocalStorage();
      } catch (apiError) {
        console.warn('API error loading cart items, using localStorage:', apiError);
        // Keep using the items from localStorage that were loaded in initializeCart
      }
    } catch (error) {
      console.error('Error loading cart items:', error);
      cartState.error = 'Unable to load your cart items. Please try again later.';
    } finally {
      cartState.loading = false;
      triggerEvent('cartUpdated');
    }
  }

  /**
   * Save cart state to localStorage
   */
  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.cartItems, JSON.stringify(cartState.items));
      localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  /**
   * Load cart state from localStorage
   */
  function loadFromLocalStorage() {
    try {
      const storedItems = localStorage.getItem(STORAGE_KEYS.cartItems);
      const lastSync = localStorage.getItem(STORAGE_KEYS.lastSync);
      
      if (storedItems) {
        cartState.items = JSON.parse(storedItems);
      }
      
      if (lastSync) {
        cartState.lastSync = new Date(lastSync);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }

  /**
   * Synchronize cart between localStorage and server
   * @returns {Promise<{success: boolean, error: string|null}>} - Result with success status and error message
   */
  async function syncWithServer() {
    if (!cartState.sessionId) {
      return { success: false, error: 'No active session' };
    }
    
    // If this is a local session, don't try to sync with server
    if (cartState.sessionId.startsWith('local_')) {
      console.log('Using local session, skipping server sync');
      return { success: true, error: null };
    }
    
    // Reset error state
    cartState.error = null;
    
    try {
      // Show syncing state
      cartState.loading = true;
      triggerEvent('cartUpdated');
      
      let serverItems = [];
      try {
        // Get the latest cart items from the server
        const response = await fetch(ENDPOINTS.cartItems.getBySession(cartState.sessionId));
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to sync with server: ${response.status} ${errorText}`);
        }
        
        // The API returns items for the session
        serverItems = await response.json();
        
        if (!serverItems || !Array.isArray(serverItems)) {
          console.warn('API returned non-array items:', serverItems);
          cartState.loading = false;
          triggerEvent('cartUpdated');
          return { success: false, error: 'Invalid server response' };
        }
        
        // For each server item, get its sizes
        const serverItemsWithSizes = await Promise.all(serverItems.map(async (item) => {
          try {
            const sizesResponse = await fetch(ENDPOINTS.cartItemSizes.getByCartItem(item.CartItemID));
            
            if (sizesResponse.ok) {
              const sizes = await sizesResponse.json();
              return {
                ...item,
                sizes: Array.isArray(sizes) ? sizes : []
              };
            }
            
            return {
              ...item,
              sizes: []
            };
          } catch (sizeError) {
            console.error(`Error fetching sizes for item ${item.CartItemID}:`, sizeError);
            return {
              ...item,
              sizes: []
            };
          }
        }));
        
        // Use the server items with sizes
        serverItems = serverItemsWithSizes;
      } catch (apiError) {
        console.warn('API error during sync, using localStorage only:', apiError);
        // Continue using localStorage data
        serverItems = [];
      }
      
      // Simplified sync strategy:
      // 1. If server has items, use them
      // 2. If server has no items but local has items, push local items to server
      
      if (serverItems.length > 0) {
        // Server has items, use them
        cartState.items = serverItems;
        cartState.error = null;
        saveToLocalStorage();
      } else if (cartState.items.length > 0) {
        // Server has no items but local has items, push local items to server
        const localItemsWithoutIds = cartState.items.filter(item => !item.CartItemID);
        
        if (localItemsWithoutIds.length === 0) {
          // No items to sync
          cartState.error = null;
          cartState.loading = false;
          triggerEvent('cartUpdated');
          return { success: true, error: null };
        }
        
        // Track sync errors
        const syncErrors = [];
        
        // Process items in parallel for better performance
        await Promise.all(localItemsWithoutIds.map(async (item) => {
          try {
            // Create the item on the server
            const itemData = {
              SessionID: cartState.sessionId,
              ProductID: item.ProductID || '',
              StyleNumber: item.StyleNumber,
              Color: item.Color,
              ImprintType: item.ImprintType,
              EmbellishmentOptions: JSON.stringify(item.EmbellishmentOptions || {}),
              DateAdded: item.DateAdded || new Date().toISOString(),
              CartStatus: item.CartStatus || 'Active',
              OrderID: item.OrderID || null
            };
            
            const createResponse = await fetch(ENDPOINTS.cartItems.create, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(itemData)
            });
            
            if (!createResponse.ok) {
              const errorText = await createResponse.text();
              throw new Error(`Failed to create item ${item.StyleNumber}: ${createResponse.status} ${errorText}`);
            }
            
            const newItem = await createResponse.json();
            
            // Track size sync errors
            const sizeErrors = [];
            
            // Create the sizes on the server
            await Promise.all((item.sizes || []).map(async (size) => {
              try {
                const sizeData = {
                  CartItemID: newItem.CartItemID,
                  Size: size.Size,
                  Quantity: size.Quantity,
                  UnitPrice: size.UnitPrice
                };
                
                const sizeResponse = await fetch(ENDPOINTS.cartItemSizes.create, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(sizeData)
                });
                
                if (!sizeResponse.ok) {
                  const errorText = await sizeResponse.text();
                  throw new Error(`Failed to create size ${size.Size}: ${sizeResponse.status} ${errorText}`);
                }
              } catch (sizeError) {
                console.error('Error syncing size:', sizeError);
                sizeErrors.push(sizeError.message);
              }
            }));
            
            // If there were size errors, add them to the sync errors
            if (sizeErrors.length > 0) {
              syncErrors.push(`Item ${item.StyleNumber}: ${sizeErrors.length} sizes failed to sync`);
            }
          } catch (itemError) {
            console.error('Error syncing item:', itemError);
            syncErrors.push(itemError.message);
          }
        }));
        
        // Check if there were any sync errors
        if (syncErrors.length > 0) {
          // Set a user-friendly error message
          if (syncErrors.length === localItemsWithoutIds.length) {
            // All items failed to sync
            cartState.error = 'Failed to sync any items with the server. Please try again later.';
          } else {
            // Some items failed to sync
            cartState.error = `Some items failed to sync with the server (${syncErrors.length} of ${localItemsWithoutIds.length}).`;
          }
        }
        
        // Reload from server to get the updated data
        try {
          await loadCartItems();
        } catch (loadError) {
          console.error('Error reloading items after sync:', loadError);
          // If we already have an error, don't overwrite it
          if (!cartState.error) {
            cartState.error = 'Items were synced but could not be reloaded. Please refresh the page.';
          }
        }
      }
      
      // Success (even with partial errors)
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return {
        success: true,
        error: cartState.error // May contain partial error message
      };
    } catch (error) {
      console.error('Error syncing with server:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        cartState.error = 'Network error. Please check your connection and try again.';
      } else {
        cartState.error = error.message || 'Unable to sync with server. Please try again later.';
      }
      
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: false, error: cartState.error };
    }
  }

  /**
   * Add an item to the cart
   * @param {Object} productData - Product data
   * @returns {Promise<{success: boolean, error: string|null}>} - Result with success status and error message
   */
  async function addToCart(productData) {
    // Reset error state
    cartState.error = null;
    
    try {
      // Show loading state
      cartState.loading = true;
      triggerEvent('cartUpdated');
      
      // Initialize cart if needed
      if (!cartState.sessionId) {
        await initializeCart();
        if (!cartState.sessionId) {
          throw new Error('Unable to create or retrieve cart session');
        }
      }
      
      // Validate product data
      if (!productData.styleNumber || !productData.color || !productData.embellishmentType) {
        throw new Error('Missing required product information');
      }
      
      if (!productData.sizes || !Array.isArray(productData.sizes) || productData.sizes.length === 0) {
        throw new Error('No sizes selected');
      }
      
      // Check if we already have items with a different embellishment type
      const existingEmbellishmentTypes = new Set(
        cartState.items
          .filter(item => item.CartStatus === 'Active')
          .map(item => item.ImprintType)
      );
      
      if (existingEmbellishmentTypes.size > 0 &&
          !existingEmbellishmentTypes.has(productData.embellishmentType)) {
        // Show warning about different embellishment types
        const proceed = confirm(
          `You already have items with ${Array.from(existingEmbellishmentTypes).join(', ')} ` +
          `in your cart. Adding items with ${productData.embellishmentType} may result in ` +
          `separate production runs. For optimal pricing and production, we recommend ` +
          `placing separate orders for different embellishment types. Do you want to proceed?`
        );
        
        if (!proceed) {
          cartState.loading = false;
          triggerEvent('cartUpdated');
          return { success: false, error: null }; // User canceled, not an error
        }
      }
      
      // Check inventory before adding
      const inventoryResponse = await fetch(
        ENDPOINTS.inventory.getByStyleAndColor(
          productData.styleNumber,
          productData.color
        )
      );
      
      if (!inventoryResponse.ok) {
        const errorText = await inventoryResponse.text();
        throw new Error(`Failed to check inventory: ${inventoryResponse.status} ${errorText}`);
      }
      
      const inventoryData = await inventoryResponse.json();
      
      // Create a map of available inventory by size
      const availableInventory = {};
      inventoryData.forEach(item => {
        if (!availableInventory[item.size]) {
          availableInventory[item.size] = 0;
        }
        availableInventory[item.size] += item.quantity;
      });
      
      // Validate requested quantities against inventory
      const validSizes = [];
      const inventoryErrors = [];
      
      for (const sizeData of productData.sizes) {
        if (!sizeData.size || !sizeData.quantity || sizeData.quantity <= 0) {
          continue; // Skip invalid sizes
        }
        
        const availableQty = availableInventory[sizeData.size] || 0;
        
        if (sizeData.quantity > availableQty) {
          inventoryErrors.push(`Only ${availableQty} units of size ${sizeData.size} are available.`);
        } else {
          validSizes.push(sizeData);
        }
      }
      
      if (inventoryErrors.length > 0) {
        // Join all inventory errors into a single message
        throw new Error(`Inventory issues:\n${inventoryErrors.join('\n')}`);
      }
      
      if (validSizes.length === 0) {
        throw new Error('No valid sizes selected');
      }
      
      // Create cart item
      const cartItemData = {
        SessionID: cartState.sessionId,
        ProductID: productData.productId || '',
        StyleNumber: productData.styleNumber,
        Color: productData.color,
        ImprintType: productData.embellishmentType,
        EmbellishmentOptions: JSON.stringify(productData.embellishmentOptions || {}),
        DateAdded: new Date().toISOString(),
        CartStatus: 'Active'
      };
      
      const response = await fetch(ENDPOINTS.cartItems.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cartItemData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add item to cart: ${response.status} ${errorText}`);
      }
      
      const newCartItem = await response.json();
      
      // Add sizes
      const sizes = [];
      const sizeErrors = [];
      
      // Process sizes in parallel for better performance
      await Promise.all(validSizes.map(async (sizeData) => {
        try {
          const sizeResponse = await fetch(ENDPOINTS.cartItemSizes.create, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              CartItemID: newCartItem.CartItemID,
              Size: sizeData.size,
              Quantity: sizeData.quantity,
              UnitPrice: sizeData.unitPrice,
              WarehouseSource: sizeData.warehouseSource || ''
            })
          });
          
          if (!sizeResponse.ok) {
            const errorText = await sizeResponse.text();
            throw new Error(`Failed to add size ${sizeData.size}: ${sizeResponse.status} ${errorText}`);
          }
          
          const newSize = await sizeResponse.json();
          sizes.push(newSize);
        } catch (sizeError) {
          sizeErrors.push(sizeError.message);
        }
      }));
      
      if (sizeErrors.length > 0) {
        // If there were errors adding sizes, delete the cart item
        await fetch(ENDPOINTS.cartItems.delete(newCartItem.CartItemID), {
          method: 'DELETE'
        });
        
        throw new Error(`Failed to add sizes:\n${sizeErrors.join('\n')}`);
      }
      
      // Add to local cart state
      cartState.items.push({
        ...newCartItem,
        sizes: sizes
      });
      
      // Save to localStorage
      saveToLocalStorage();
      
      // Success!
      cartState.error = null;
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Error adding to cart:', error);
      cartState.error = error.message || 'Failed to add item to cart';
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: false, error: cartState.error };
    }
  }

  /**
   * Update item quantity
   * @param {number} cartItemId - Cart item ID
   * @param {string} size - Size to update
   * @param {number} quantity - New quantity
   * @returns {Promise<{success: boolean, error: string|null}>} - Result with success status and error message
   */
  async function updateQuantity(cartItemId, size, quantity) {
    // Reset error state
    cartState.error = null;
    
    try {
      // Show loading state
      cartState.loading = true;
      triggerEvent('cartUpdated');
      
      // Find the item and size in the cart
      const itemIndex = cartState.items.findIndex(item => item.CartItemID === cartItemId);
      
      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }
      
      const item = cartState.items[itemIndex];
      const sizeIndex = item.sizes.findIndex(s => s.Size === size);
      
      if (sizeIndex === -1) {
        throw new Error('Size not found for item');
      }
      
      const sizeItem = item.sizes[sizeIndex];
      
      // Check inventory before updating
      const inventoryResponse = await fetch(
        ENDPOINTS.inventory.getByStyleAndColor(
          item.StyleNumber,
          item.Color
        )
      );
      
      if (!inventoryResponse.ok) {
        const errorText = await inventoryResponse.text();
        throw new Error(`Failed to check inventory: ${inventoryResponse.status} ${errorText}`);
      }
      
      const inventoryData = await inventoryResponse.json();
      
      // Calculate available inventory for this size
      let availableQty = 0;
      inventoryData.forEach(invItem => {
        if (invItem.size === size) {
          availableQty += invItem.quantity;
        }
      });
      
      if (quantity > availableQty) {
        cartState.error = `Sorry, only ${availableQty} units of size ${size} are available.`;
        cartState.loading = false;
        triggerEvent('cartUpdated');
        return { success: false, error: cartState.error };
      }
      
      if (quantity <= 0) {
        // Remove the size
        const deleteResponse = await fetch(ENDPOINTS.cartItemSizes.delete(sizeItem.SizeItemID), {
          method: 'DELETE'
        });
        
        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          throw new Error(`Failed to delete size: ${deleteResponse.status} ${errorText}`);
        }
        
        // Remove from local state
        item.sizes.splice(sizeIndex, 1);
        
        // If no sizes left, remove the item
        if (item.sizes.length === 0) {
          const removeResult = await removeItem(cartItemId);
          if (!removeResult.success) {
            throw new Error(removeResult.error || 'Failed to remove item after deleting last size');
          }
        } else {
          // Save to localStorage
          saveToLocalStorage();
          
          // Success!
          cartState.error = null;
          cartState.loading = false;
          triggerEvent('cartUpdated');
        }
        
        return { success: true, error: null };
      } else {
        // Update the size quantity
        const updateResponse = await fetch(ENDPOINTS.cartItemSizes.update(sizeItem.SizeItemID), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...sizeItem,
            Quantity: quantity
          })
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update size quantity: ${updateResponse.status} ${errorText}`);
        }
        
        // Update local state
        item.sizes[sizeIndex].Quantity = quantity;
        
        // Save to localStorage
        saveToLocalStorage();
        
        // Success!
        cartState.error = null;
        cartState.loading = false;
        triggerEvent('cartUpdated');
        
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      cartState.error = error.message || 'Failed to update quantity';
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: false, error: cartState.error };
    }
  }

  /**
   * Remove an item from the cart
   * @param {number} cartItemId - Cart item ID
   * @returns {Promise<{success: boolean, error: string|null}>} - Result with success status and error message
   */
  async function removeItem(cartItemId) {
    // Reset error state
    cartState.error = null;
    
    try {
      // Show loading state
      cartState.loading = true;
      triggerEvent('cartUpdated');
      
      // Find the item in the cart
      const itemIndex = cartState.items.findIndex(item => item.CartItemID === cartItemId);
      
      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }
      
      // Delete from server
      const response = await fetch(ENDPOINTS.cartItems.delete(cartItemId), {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete item: ${response.status} ${errorText}`);
      }
      
      // Remove from local state
      cartState.items.splice(itemIndex, 1);
      
      // Save to localStorage
      saveToLocalStorage();
      
      // Success!
      cartState.error = null;
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Error removing item:', error);
      cartState.error = error.message || 'Failed to remove item';
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: false, error: cartState.error };
    }
  }

  /**
   * Save cart for later
   * @returns {Promise<{success: boolean, error: string|null}>} - Result with success status and error message
   */
  async function saveForLater() {
    // Reset error state
    cartState.error = null;
    
    try {
      // Show loading state
      cartState.loading = true;
      triggerEvent('cartUpdated');
      
      const activeItems = cartState.items.filter(item => item.CartStatus === 'Active');
      
      if (activeItems.length === 0) {
        cartState.error = 'No active items to save for later';
        cartState.loading = false;
        triggerEvent('cartUpdated');
        return { success: false, error: cartState.error };
      }
      
      // Track any errors that occur during the process
      const errors = [];
      
      // Update all items to SavedForLater status
      await Promise.all(activeItems.map(async (item) => {
        try {
          const updateResponse = await fetch(ENDPOINTS.cartItems.update(item.CartItemID), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...item,
              CartStatus: 'SavedForLater'
            })
          });
          
          if (updateResponse.ok) {
            // Update local state
            item.CartStatus = 'SavedForLater';
          } else {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to save item ${item.StyleNumber} for later: ${updateResponse.status} ${errorText}`);
          }
        } catch (itemError) {
          console.error('Error saving item for later:', itemError);
          errors.push(itemError.message);
        }
      }));
      
      // Save to localStorage
      saveToLocalStorage();
      
      // Check if there were any errors
      if (errors.length > 0) {
        if (errors.length === activeItems.length) {
          // All items failed
          cartState.error = 'Failed to save any items for later';
          cartState.loading = false;
          triggerEvent('cartUpdated');
          return { success: false, error: cartState.error };
        } else {
          // Some items failed, some succeeded
          cartState.error = `Some items could not be saved for later: ${errors.length} of ${activeItems.length} failed`;
          cartState.loading = false;
          triggerEvent('cartUpdated');
          return { success: true, error: cartState.error };
        }
      }
      
      // Success!
      cartState.error = null;
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Error saving cart for later:', error);
      cartState.error = error.message || 'Failed to save cart for later';
      cartState.loading = false;
      triggerEvent('cartUpdated');
      
      return { success: false, error: cartState.error };
    }
  }

  /**
   * Get cart items
   * @param {string} status - Filter by status (optional)
   * @returns {Array} - Cart items
   */
  function getCartItems(status) {
    // Ensure cartState.items is an array
    if (!cartState.items || !Array.isArray(cartState.items)) {
      cartState.items = [];
      saveToLocalStorage();
    }
    
    if (status) {
      return cartState.items.filter(item => item.CartStatus === status);
    }
    return cartState.items;
  }

  /**
   * Get cart count
   * @returns {number} - Total number of items in cart
   */
  function getCartCount() {
    let count = 0;
    
    // Ensure cartState.items is an array
    if (!cartState.items || !Array.isArray(cartState.items)) {
      cartState.items = [];
      saveToLocalStorage();
      return count;
    }
    
    cartState.items.forEach(item => {
      if (item.CartStatus === 'Active' && item.sizes && Array.isArray(item.sizes)) {
        item.sizes.forEach(size => {
          count += size.Quantity || 0;
        });
      }
    });
    
    return count;
  }

  /**
   * Get cart total
   * @returns {number} - Total price of items in cart
   */
  function getCartTotal() {
    let total = 0;
    
    // Ensure cartState.items is an array
    if (!cartState.items || !Array.isArray(cartState.items)) {
      cartState.items = [];
      saveToLocalStorage();
      return total;
    }
    
    cartState.items.forEach(item => {
      if (item.CartStatus === 'Active' && item.sizes && Array.isArray(item.sizes)) {
        item.sizes.forEach(size => {
          total += (size.Quantity || 0) * (size.UnitPrice || 0);
        });
      }
    });
    
    return total;
  }

  /**
   * Check if cart has items with a specific embellishment type
   * @param {string} embellishmentType - Embellishment type to check
   * @returns {boolean} - True if cart has items with the specified embellishment type
   */
  function hasEmbellishmentType(embellishmentType) {
    // Ensure cartState.items is an array
    if (!cartState.items || !Array.isArray(cartState.items)) {
      cartState.items = [];
      saveToLocalStorage();
      return false;
    }
    
    return cartState.items.some(item =>
      item.CartStatus === 'Active' && item.ImprintType === embellishmentType
    );
  }

  /**
   * Get embellishment types in cart
   * @returns {Array} - Array of embellishment types in cart
   */
  function getEmbellishmentTypes() {
    const types = new Set();
    
    // Ensure cartState.items is an array
    if (!cartState.items || !Array.isArray(cartState.items)) {
      cartState.items = [];
      saveToLocalStorage();
      return [];
    }
    
    cartState.items.forEach(item => {
      if (item.CartStatus === 'Active' && item.ImprintType) {
        types.add(item.ImprintType);
      }
    });
    
    return Array.from(types);
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  function addEventListener(event, callback) {
    if (eventListeners[event]) {
      eventListeners[event].push(callback);
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  function removeEventListener(event, callback) {
    if (eventListeners[event]) {
      const index = eventListeners[event].indexOf(callback);
      if (index !== -1) {
        eventListeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Trigger event
   * @param {string} event - Event name
   */
  function triggerEvent(event) {
    if (eventListeners[event]) {
      eventListeners[event].forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }
  }

  // Public API
  return {
    initializeCart,
    addToCart,
    updateQuantity,
    removeItem,
    saveForLater,
    getCartItems,
    getCartCount,
    getCartTotal,
    hasEmbellishmentType,
    getEmbellishmentTypes,
    addEventListener,
    removeEventListener,
    syncWithServer,
    isLoading: () => cartState.loading,
    getError: () => cartState.error
  };
})();

// Initialize cart when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  NWCACart.initializeCart();
  
  // Update cart count in header (if element exists)
  const updateCartCount = function() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
      cartCountElement.textContent = NWCACart.getCartCount();
    }
  };
  
  // Listen for cart updates
  NWCACart.addEventListener('cartUpdated', updateCartCount);
  
  // Initial update
  updateCartCount();
});

// Example embellishment options structures for different types
const embellishmentOptionsExamples = {
  // Embroidery options
  embroidery: {
    stitchCount: 8000, // 5000, 8000, or 10000
    location: 'left-chest' // left-chest, right-chest, full-back, etc.
  },
  
  // Cap embroidery options
  'cap-embroidery': {
    stitchCount: 8000, // 5000, 8000, or 10000
    location: 'front' // front, side, back
  },
  
  // DTG options
  dtg: {
    location: 'FF', // LC, FF, FB, JF, JB, LC_FB, FF_FB, JF_JB
    colorType: 'full-color' // full-color, white-only
  },
  
  // Screen print options
  'screen-print': {
    colorCount: 3, // 1-6
    additionalLocations: [
      {
        location: 'back',
        colorCount: 1
      }
    ],
    requiresWhiteBase: true, // For dark garments
    specialInk: false // Reflective, metallic, etc.
  }
};