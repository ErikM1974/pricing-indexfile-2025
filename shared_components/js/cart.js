// cart.js - Client-side shopping cart implementation

/**
 * Shopping Cart Module for Northwest Custom Apparel
 * Handles cart operations and synchronization with Caspio database
 */
// Check if NWCACart is already defined to prevent redeclaration
if (typeof window.NWCACart === 'undefined') {
  console.log("Initializing NWCACart module");
  window.NWCACart = (function() {
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
      console.log("Initializing cart...");
      cartState.loading = true;
      
      // Load items from localStorage first
      loadFromLocalStorage();
      console.log("Loaded from localStorage:", cartState.items.length, "items");
      
      // Check if we have a session ID in localStorage
      const storedSessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
      console.log("Stored session ID:", storedSessionId);
      
      if (storedSessionId) {
        try {
          // Try to get the session from the API
          console.log("Verifying session with API:", ENDPOINTS.cartSessions.getById(storedSessionId));
          const response = await fetch(ENDPOINTS.cartSessions.getById(storedSessionId));
          
          if (response.ok) {
            const sessions = await response.json();
            console.log("API returned sessions:", sessions);
            
            // Check if we got any sessions back and if the first one is active
            if (sessions && sessions.length > 0 && sessions[0].IsActive) {
              console.log("Using existing active session");
              cartState.sessionId = storedSessionId;
              await loadCartItems();
            } else {
              console.log("Session exists but is not active, creating new session");
              // Session is no longer active, create a new one
              await createNewSession();
            }
          } else {
            console.log("Session not found or API error, creating new session");
            // Session not found or other error, create a new one
            await createNewSession();
          }
        } catch (error) {
          console.error('Error retrieving session:', error);
          console.log("Creating new session after error");
          await createNewSession();
        }
      } else {
        console.log("No stored session ID, creating new session");
        // No stored session ID, create a new one
        await createNewSession();
      }
      
      // Try to sync with server (this will update the localStorage if needed)
      try {
        console.log("Syncing with server...");
        await syncWithServer();
      } catch (error) {
        console.warn('Could not sync with server, using local storage only:', error);
      }
      
      cartState.loading = false;
      console.log("Cart initialization complete, triggering cartUpdated event");
      triggerEvent('cartUpdated');
      
      // Set initialized flag and dispatch custom event
      window.NWCACart.isInitialized = true;
      document.dispatchEvent(new CustomEvent('nwcacartInitialized'));
      console.log("[CART:INIT] NWCACart initialized and event dispatched");
      
      // Recalculate prices for all embellishment types in the cart
      try {
        const embTypes = getEmbellishmentTypes();
        console.log("[CART:INIT] Recalculating prices for embellishment types:", embTypes);
        
        for (const embType of embTypes) {
          if (typeof window.recalculatePricesForEmbellishmentType === 'function') {
            console.log(`[CART:INIT] Recalculating prices for ${embType}`);
            await window.recalculatePricesForEmbellishmentType(embType);
          }
        }
      } catch (recalcError) {
        console.error("[CART:INIT] Error recalculating prices:", recalcError);
      }
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
      
      // Generate a unique session ID
      const generatedSessionId = 'sess_' + Math.random().toString(36).substring(2, 10);
      
      const sessionData = {
        SessionID: generatedSessionId,
        CreateDate: new Date().toISOString(),
        LastActivity: new Date().toISOString(),
        UserAgent: userAgent,
        IPAddress: '', // This will be set by the server
        IsActive: true
      };
      
      try {
        console.log("Creating new session with data:", sessionData);
        
        const response = await fetch(ENDPOINTS.cartSessions.create, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sessionData)
        });
        
        if (response.ok) {
          const responseData = await response.json();
          console.log("Session creation response:", responseData);
          
          // The API returns a success message but doesn't include the session ID
          // Always use our generated ID since it's what we sent to the server
          console.log("Using generated session ID:", generatedSessionId);
          cartState.sessionId = generatedSessionId;
          
          localStorage.setItem(STORAGE_KEYS.sessionId, cartState.sessionId);
          cartState.items = [];
          saveToLocalStorage();
          return cartState.sessionId;
        } else {
          const errorText = await response.text();
          console.error(`Failed to create session: ${response.status} ${errorText}`);
          throw new Error(`Failed to create a new session: ${response.status}`);
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
        console.log("loadCartItems - API returned items:", items);
        
        if (!items || !Array.isArray(items)) {
          console.warn('API returned non-array items:', items);
          return;
        }
        
        // For each item, get its sizes
        const itemsWithSizes = await Promise.all(items.map(async (item) => {
          const sizeFetchUrl = ENDPOINTS.cartItemSizes.getByCartItem(item.CartItemID);
          console.log(`[loadCartItems] Fetching sizes for item ${item.CartItemID} from: ${sizeFetchUrl}`);
          try {
            const sizesResponse = await fetch(sizeFetchUrl);
            console.log(`[loadCartItems] Sizes response status for item ${item.CartItemID}: ${sizesResponse.status}`);
            
            if (sizesResponse.ok) {
              const sizes = await sizesResponse.json();
              console.log(`[loadCartItems] Raw sizes data for item ${item.CartItemID}:`, JSON.stringify(sizes)); // Log raw data
              return {
                ...item,
                sizes: Array.isArray(sizes) ? sizes : []
              };
            } else {
              console.warn(`[loadCartItems] Failed to fetch sizes for item ${item.CartItemID}. Status: ${sizesResponse.status}`);
              const errorText = await sizesResponse.text();
              console.warn(`[loadCartItems] Error details for item ${item.CartItemID}: ${errorText}`);
            }
            
            return {
              ...item,
              sizes: []
            };
          } catch (sizeError) {
            console.error(`[loadCartItems] Error fetching sizes for item ${item.CartItemID}:`, sizeError);
            return {
              ...item,
              sizes: []
            };
          }
        }));
        
        // Handle both imageUrl (lowercase) and ImageURL (uppercase) values
        itemsWithSizes.forEach(item => {
          console.log(`[CART:LOAD_ITEMS] Item ${item.CartItemID} imageUrl before: '${item.imageUrl}', ImageURL: '${item.ImageURL}'`);
          
          // If ImageURL exists (Caspio format), use that value for both properties
          if (item.ImageURL) {
            item.imageUrl = item.ImageURL; // Ensure lowercase version has the value too
            console.log(`[CART:LOAD_ITEMS] Using ImageURL value: '${item.ImageURL}'`);
          }
          // If only lowercase exists, use it for both
          else if (item.imageUrl) {
            item.ImageURL = item.imageUrl; // Ensure uppercase version has the value too
            console.log(`[CART:LOAD_ITEMS] Using imageUrl value: '${item.imageUrl}'`);
          }
          // If neither exists, set both to empty string
          else {
            item.imageUrl = '';
            item.ImageURL = '';
            console.log(`[CART:LOAD_ITEMS] No image URL found, using empty string`);
          }
          
          console.log(`[CART:LOAD_ITEMS] Item ${item.CartItemID} final imageUrl: '${item.imageUrl}', ImageURL: '${item.ImageURL}'`);
        });

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
        console.log("syncWithServer - API returned items:", serverItems);
        
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
        // Handle both imageUrl (lowercase) and ImageURL (uppercase) values
        serverItemsWithSizes.forEach(item => {
          console.log(`[CART:SYNC] Item ${item.CartItemID} imageUrl before: '${item.imageUrl}', ImageURL: '${item.ImageURL}'`);
          
          // If ImageURL exists (Caspio format), use that value for both properties
          if (item.ImageURL) {
            item.imageUrl = item.ImageURL; // Ensure lowercase version has the value too
            console.log(`[CART:SYNC] Using ImageURL value: '${item.ImageURL}'`);
          }
          // If only lowercase exists, use it for both
          else if (item.imageUrl) {
            item.ImageURL = item.imageUrl; // Ensure uppercase version has the value too
            console.log(`[CART:SYNC] Using imageUrl value: '${item.imageUrl}'`);
          }
          // If neither exists, set both to empty string
          else {
            item.imageUrl = '';
            item.ImageURL = '';
            console.log(`[CART:SYNC] No image URL found, using empty string`);
          }
          
          console.log(`[CART:SYNC] Item ${item.CartItemID} final imageUrl: '${item.imageUrl}', ImageURL: '${item.ImageURL}'`);
        });
        
        serverItems = serverItemsWithSizes;
      } catch (apiError) {
        console.warn('API error during sync, using localStorage only:', apiError);
        // Continue using localStorage data
        // Handle both imageUrl and ImageURL formats for local items
        if (cartState.items && cartState.items.length > 0) {
             cartState.items.forEach(item => {
                 // If ImageURL exists (Caspio format), use that value for both properties
                 if (item.ImageURL) {
                     item.imageUrl = item.ImageURL; // Ensure lowercase version has the value too
                 }
                 // If only lowercase exists, use it for both
                 else if (item.imageUrl) {
                     item.ImageURL = item.imageUrl; // Ensure uppercase version has the value too
                 }
                 // If neither exists, set both to empty string
                 else {
                     item.imageUrl = '';
                     item.ImageURL = '';
                 }
             });
        }
        serverItems = []; // Reset serverItems as the API call failed
      }
      
      // Simplified sync strategy:
      // 1. If server has items, use them
      // 2. If server has no items but local has items, push local items to server
      
      if (serverItems.length > 0) {
        // Server has items, use them
        // Server has items, use them (imageUrl was added above)
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
              ImageURL: item.ImageURL || item.imageUrl || '', // Include ImageURL property with fallback to imageUrl
              imageUrl: item.imageUrl || item.ImageURL || '', // Keep imageUrl for consistency
              PRODUCT_TITLE: item.PRODUCT_TITLE || `${item.StyleNumber} - ${item.Color}`, // Include product title
              EmbellishmentOptions: JSON.stringify(item.EmbellishmentOptions || {}),
              DateAdded: item.DateAdded || new Date().toISOString(),
              CartStatus: item.CartStatus || 'Active',
              OrderID: item.OrderID || null
            };
            
            // Log the image URL being synced to server
            console.log(`[CART:SYNC_IMAGE] Syncing item ${item.StyleNumber} ${item.Color} with image URL:`, {
              hasImageURL: !!itemData.ImageURL,
              hasImageUrl: !!itemData.imageUrl,
              imageValue: itemData.imageUrl || itemData.ImageURL || 'MISSING'
            });
            
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
                // Create payload, ensuring we don't include SizeItemID which is an Autonumber field in Caspio
                const sizeData = {
                  CartItemID: newItem.CartItemID,
                  Size: size.Size,
                  Quantity: size.Quantity,
                  UnitPrice: size.UnitPrice
                };
                
                // Only add WarehouseSource if it exists
                if (size.WarehouseSource) {
                  sizeData.WarehouseSource = size.WarehouseSource;
                }
                
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
          if (syncErrors.length === localItemsWithoutIds.length) {
            // All items failed to sync
            cartState.error = 'Failed to sync any items with the server. Please try again later.';
          } else {
            // Some items failed to sync
            cartState.error = `Some items could not be synced with the server (${syncErrors.length} of ${localItemsWithoutIds.length}).`;
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
  // Internal debug function
  function debugCart(area, ...args) {
    const debug = window.location.hostname === 'localhost' ||
                 window.location.hostname === '127.0.0.1' ||
                 window.location.search.includes('debug=true');
    if (debug) {
      console.log(`[CART:${area}]`, ...args);
    }
  }

  async function addToCart(productData) {
    console.log("Starting add to cart process in NWCACart");
    console.log("Product data:", productData);
    
    // Reset error state
    cartState.error = null;

    try {
      // Show loading state
      cartState.loading = true;
      triggerEvent('cartUpdated');

      // Initialize cart if needed
      if (!cartState.sessionId) {
        debugCart("ADD", "No session ID found, initializing cart...");
        await initializeCart();
        if (!cartState.sessionId) {
          throw new Error('Unable to create or retrieve cart session');
        }
        debugCart("ADD", "Cart initialized with session ID:", cartState.sessionId);
      }

      // Validate product data
      if (!productData.styleNumber || !productData.color || !productData.embellishmentType) {
        debugCart("ADD-ERROR", "Missing required product information", productData);
        throw new Error('Missing required product information');
      }

      if (!productData.sizes || !Array.isArray(productData.sizes) || productData.sizes.length === 0) {
        debugCart("ADD-ERROR", "No sizes selected", productData.sizes);
        throw new Error('No sizes selected');
      }
      debugCart("ADD", "Product data validated");

      // --- START Custom Validation Rules ---

      const activeCartItems = cartState.items.filter(item => item.CartStatus === 'Active');
      const newItemEmbType = productData.embellishmentType;
      const newItemIsCapEmbroidery = newItemEmbType === "Cap Embroidery";

      if (activeCartItems.length > 0) {
        const firstCartItemEmbType = activeCartItems[0].ImprintType;

        // 1. Embellishment Type Validation
        if (newItemEmbType !== firstCartItemEmbType) {
          // Check if one is "Cap Embroidery" and the other is not
          const oneIsCapOtherIsNot = (newItemIsCapEmbroidery && firstCartItemEmbType !== "Cap Embroidery") ||
                                   (!newItemIsCapEmbroidery && firstCartItemEmbType === "Cap Embroidery");
          const generalMix = productData.embellishmentType !== "Cap Embroidery" && firstCartItemEmbType !== "Cap Embroidery";


          if (oneIsCapOtherIsNot) {
             alert("Only one embellishment type per cart is allowed when 'Cap Embroidery' is selected. Please create a new order for different embellishment types.");
             debugCart("ADD-VALIDATION-FAIL", "Mixed embellishment types with Cap Embroidery denied.", { newItem: newItemEmbType, cartHas: firstCartItemEmbType });
             cartState.loading = false;
             triggerEvent('cartUpdated');
             return { success: false, error: "Mixed embellishment types with Cap Embroidery." };
          } else if (generalMix) {
            // This is the original logic for general mixed embellishment types, kept for now.
            // If the new logic is to strictly prevent *any* mix if Cap Embroidery is involved, this part might be redundant
            // or needs to be adjusted based on the exact requirement for non-cap mixes.
            // For now, the original confirm dialog for general mixes will still appear if this condition is met.
            debugCart("ADD", "Different embellishment type detected (general mix, not involving Cap Embroidery specifically in this conflict)", {existing: firstCartItemEmbType, new: newItemEmbType});
             const proceedGeneralMix = confirm(
              `You already have items with ${firstCartItemEmbType} ` +
              `in your cart. Adding items with ${newItemEmbType} may result in ` +
              `separate production runs. For optimal pricing and production, we recommend ` +
              `placing separate orders for different embellishment types. Do you want to proceed?`
            );
            if (!proceedGeneralMix) {
              debugCart("ADD", "User canceled adding item due to different embellishment type (general mix)");
              cartState.loading = false;
              triggerEvent('cartUpdated');
              return { success: false, error: null }; // User canceled
            }
            debugCart("ADD", "User chose to proceed with different embellishment type (general mix)");
          }
        }
      }

      // 2. Stitch Count Validation (for "Cap Embroidery")
      if (newItemIsCapEmbroidery) {
        const newItemStitchCount = productData.stitchCount; // Added in add-to-cart.js
        if (!newItemStitchCount) {
            alert("Error: Stitch count is missing for the cap embroidery item. Cannot add to cart.");
            debugCart("ADD-VALIDATION-FAIL", "Cap embroidery item missing stitchCount.", productData);
            cartState.loading = false;
            triggerEvent('cartUpdated');
            return { success: false, error: "Missing stitch count for cap embroidery item." };
        }

        const capEmbroideryItemsInCart = activeCartItems.filter(item => item.ImprintType === "Cap Embroidery");
        if (capEmbroideryItemsInCart.length > 0) {
          const existingStitchCount = capEmbroideryItemsInCart[0].EmbellishmentOptions ? JSON.parse(capEmbroideryItemsInCart[0].EmbellishmentOptions).stitchCount : undefined;
          // Fallback if EmbellishmentOptions is not structured as expected or stitchCount is directly on item
          const directStitchCount = capEmbroideryItemsInCart[0].stitchCount;

          let currentCartStitchCount = existingStitchCount || directStitchCount;


          if (!currentCartStitchCount && capEmbroideryItemsInCart[0].EmbellishmentOptions) {
             try {
                const opts = JSON.parse(capEmbroideryItemsInCart[0].EmbellishmentOptions);
                currentCartStitchCount = opts.stitchCount;
             } catch (e) {
                console.warn("Could not parse EmbellishmentOptions for stitch count from existing cart item", capEmbroideryItemsInCart[0]);
             }
          }
           // If still no stitch count, check if it was added directly to the item (older items might have this)
          if (!currentCartStitchCount && capEmbroideryItemsInCart[0].stitchCount) {
              currentCartStitchCount = capEmbroideryItemsInCart[0].stitchCount;
          }


          if (currentCartStitchCount && newItemStitchCount.toString() !== currentCartStitchCount.toString()) {
            alert(`All cap embroidery items in the cart must have the same stitch count. The cart has items with ${currentCartStitchCount} stitches, and you are trying to add an item with ${newItemStitchCount} stitches. Please adjust the stitch count or create a new order.`);
            debugCart("ADD-VALIDATION-FAIL", "Different stitch counts for Cap Embroidery denied.", { newItem: newItemStitchCount, cartHas: currentCartStitchCount });
            cartState.loading = false;
            triggerEvent('cartUpdated');
            return { success: false, error: "Different stitch counts for Cap Embroidery." };
          }
        }
      }
      // --- END Custom Validation Rules ---


      // Check inventory before adding
      debugCart("ADD", "Checking inventory for", {style: productData.styleNumber, color: productData.color});
      const inventoryResponse = await fetch(
        ENDPOINTS.inventory.getByStyleAndColor(
          productData.styleNumber,
          productData.color
        )
      );

      if (!inventoryResponse.ok) {
        const errorText = await inventoryResponse.text();
        debugCart("ADD-ERROR", `Failed to check inventory: ${inventoryResponse.status} ${errorText}`);
        throw new Error(`Failed to check inventory: ${inventoryResponse.status} ${errorText}`);
      }

      const inventoryData = await inventoryResponse.json();
      debugCart("ADD", "Inventory data received:", inventoryData);

      // Create a map of available inventory by size
      const availableInventory = {};
      inventoryData.forEach(item => {
        if (!availableInventory[item.size]) {
          availableInventory[item.size] = 0;
        }
        availableInventory[item.size] += item.quantity;
      });
      debugCart("ADD", "Available inventory map:", availableInventory);

      // Validate requested quantities against inventory
      const validSizes = [];
      const inventoryErrors = [];

      for (const sizeData of productData.sizes) {
        if (!sizeData.size || sizeData.quantity === undefined || sizeData.quantity === null || sizeData.quantity < 0) {
           debugCart("ADD", "Skipping invalid size data:", sizeData);
           continue; // Skip invalid or zero/negative quantities
        }
        const requestedQty = parseInt(sizeData.quantity) || 0; // Ensure quantity is a number

        if (requestedQty <= 0) {
             debugCart("ADD", "Skipping size with zero or negative quantity:", sizeData);
             continue;
        }

        const availableQty = availableInventory[sizeData.size] || 0;
        debugCart("ADD", `Checking quantity for size ${sizeData.size}: Requested ${requestedQty}, Available ${availableQty}`);

        if (requestedQty > availableQty) {
          inventoryErrors.push(`Only ${availableQty} units of size ${sizeData.size} are available.`);
          debugCart("ADD-ERROR", `Inventory insufficient for size ${sizeData.size}`);
        } else {
          validSizes.push({...sizeData, quantity: requestedQty}); // Use parsed quantity
          debugCart("ADD", `Size ${sizeData.size} quantity ${requestedQty} is valid`);
        }
      }

      if (inventoryErrors.length > 0) {
        // Join all inventory errors into a single message
        debugCart("ADD-ERROR", "Inventory validation failed", inventoryErrors);
        throw new Error(`Inventory issues:\n${inventoryErrors.join('\n')}`);
      }

      if (validSizes.length === 0) {
        debugCart("ADD-ERROR", "No valid sizes selected after validation");
        throw new Error('Please select at least one size and quantity');
      }
      debugCart("ADD", "Inventory validated, valid sizes:", validSizes);

      // --- Check for existing item ---
      const existingItemIndex = cartState.items.findIndex(item =>
          item.StyleNumber === productData.styleNumber &&
          item.Color === productData.color &&
          item.ImprintType === productData.embellishmentType &&
          item.CartStatus === 'Active' // Only consider active items
      );

      if (existingItemIndex > -1) {
          // --- Update Existing Item ---
          debugCart("ADD", "Found existing item, updating quantities");
          const existingItem = cartState.items[existingItemIndex];
          const existingCartItemID = existingItem.CartItemID;

          // Fetch existing sizes for the item to get SizeItemIDs and current quantities
          let existingSizesData = [];
          try {
              const existingSizesResponse = await fetch(ENDPOINTS.cartItemSizes.getByCartItem(existingCartItemID));
              if (!existingSizesResponse.ok) {
                  const errorText = await existingSizesResponse.text();
                  throw new Error(`Failed to fetch existing sizes for item ${existingCartItemID}: ${existingSizesResponse.status} ${errorText}`);
              }
              existingSizesData = await existingSizesResponse.json();
              if (!Array.isArray(existingSizesData)) {
                  debugCart("ADD-WARN", "Received non-array for existing sizes, treating as empty", existingSizesData);
                  existingSizesData = [];
              }
              debugCart("ADD", `Fetched ${existingSizesData.length} existing sizes for item ${existingCartItemID}`);
          } catch (fetchError) {
              console.error("Error fetching existing sizes:", fetchError);
              throw new Error(`Network error fetching existing sizes for item ${existingCartItemID}: ${fetchError.message}`);
          }

          const existingSizesMap = new Map(existingSizesData.map(s => [s.Size, s])); // Map Size -> SizeItem object

          const sizeUpdatePromises = validSizes.map(async (newSizeData) => {
              const existingSize = existingSizesMap.get(newSizeData.size);
              
              if (existingSize) {
                  // --- Update existing size ---
                  const newQuantity = (parseInt(existingSize.Quantity) || 0) + (parseInt(newSizeData.quantity) || 0);
                  debugCart("ADD", `Updating size ${newSizeData.size} for item ${existingCartItemID}. Old Qty: ${existingSize.Quantity}, Add Qty: ${newSizeData.quantity}, New Qty: ${newQuantity}`);
                  
                  // Prepare payload for update
                  const updatePayload = {
                      // Include all fields expected by the API for update, even if not changing
                      CartItemID: existingCartItemID,
                      Size: existingSize.Size,
                      Quantity: newQuantity,
                      UnitPrice: existingSize.UnitPrice // Assuming price doesn't change when quantity is added
                  };
                  if (existingSize.WarehouseSource) { // Preserve warehouse if it exists
                      updatePayload.WarehouseSource = existingSize.WarehouseSource;
                  }

                  const updateResponse = await fetch(ENDPOINTS.cartItemSizes.update(existingSize.SizeItemID), {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updatePayload)
                  });
                  if (!updateResponse.ok) {
                      const errorText = await updateResponse.text();
                      throw new Error(`Failed to update size ${newSizeData.size}: ${updateResponse.status} ${errorText}`);
                  }
                  return await updateResponse.json(); // Return updated size data
              } else {
                  // --- Create new size for existing item ---
                  debugCart("ADD", `Creating new size ${newSizeData.size} with quantity ${newSizeData.quantity} for item ${existingCartItemID}`);
                  const sizeDataPayload = {
                      CartItemID: existingCartItemID,
                      Size: newSizeData.size,
                      Quantity: newSizeData.quantity,
                      UnitPrice: newSizeData.unitPrice // Use unit price from the new item data
                  };
                  if (newSizeData.warehouseSource) {
                      sizeDataPayload.WarehouseSource = newSizeData.warehouseSource;
                  }
                  const createResponse = await fetch(ENDPOINTS.cartItemSizes.create, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(sizeDataPayload)
                  });
                  if (!createResponse.ok) {
                      const errorText = await createResponse.text();
                      throw new Error(`Failed to create size ${newSizeData.size}: ${createResponse.status} ${errorText}`);
                  }
                  return await createResponse.json(); // Return created size data
              }
          });

          // Wait for all size updates/creations to complete
          const updatedSizesResults = await Promise.allSettled(sizeUpdatePromises);

          const successfulUpdates = updatedSizesResults
              .filter(result => result.status === 'fulfilled')
              .map(result => result.value);
          const failedUpdates = updatedSizesResults
              .filter(result => result.status === 'rejected');

          if (failedUpdates.length > 0) {
              const errorMessages = failedUpdates.map(f => f.reason.message || f.reason).join('\n');
              console.error("Errors updating/creating sizes:", errorMessages);
              // Throw an error to prevent inconsistent state
              throw new Error(`Failed to update/create some sizes:\n${errorMessages}`);
          }

          // Reload ALL cart items from the server to refresh local state accurately
          debugCart("ADD", "Sizes updated/created, reloading cart items from server...");
          await loadCartItems(); // This refreshes cartState.items
          debugCart("ADD", "Cart items reloaded after update");

      } else {
          // --- Create New Item (Original Logic) ---
          debugCart("ADD", "No existing item found, creating new item");
          
          // Create the cart item data

          const cartItemData = {
            SessionID: cartState.sessionId,
            ProductID: productData.productId || productData.ProductID || `${productData.styleNumber}_${productData.color}`,
            StyleNumber: productData.styleNumber,
            Color: productData.color,
            ImprintType: productData.embellishmentType,
            ImageURL: productData.imageUrl || '', // Use capital 'URL' format for Caspio compatibility
            imageUrl: productData.imageUrl || '', // Keep lowercase version for local use
            PRODUCT_TITLE: productData.PRODUCT_TITLE || `${productData.styleNumber} - ${productData.color}`, // Include product title
            EmbellishmentOptions: JSON.stringify(productData.embellishmentOptions || {}),
            DateAdded: new Date().toISOString(),
            CartStatus: 'Active'
          };
          

          debugCart("ADD", "Creating cart item on server with data:", cartItemData);
          
          // Prepare the request body
          const requestBody = JSON.stringify(cartItemData);
            
          const response = await fetch(ENDPOINTS.cartItems.create, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: requestBody
          });

          // Process the response
          const responseText = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            if (!response.ok) {
              throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            responseData = { status: 'success', message: 'Non-JSON response received' };
          }

          if (!response.ok) {
            debugCart(`[CART:ADD] API Error creating cart item:`, responseData);
             throw new Error(`API Error creating cart item: ${response.status} ${responseData.message || responseText}`);
          }

          // Attempt to extract CartItemID directly from the response
          let extractedCartItemID = responseData?.cartItem?.CartItemID;
          debugCart(`[CART:ADD] Attempted direct extraction of CartItemID yields: ${extractedCartItemID}`);

          // If CartItemID wasn't found directly, try reloading and finding it
          if (!extractedCartItemID) {
              console.warn("[CART:ADD] CartItemID not found directly in response. Attempting reload and search...");
              debugCart("ADD", "Reloading cart items to find the newly created item's ID.");
              await loadCartItems(); // Refresh local state from server

              // Try to find the item we just added in the refreshed list
              // Match based on key properties. Using DateAdded might be unreliable, focus on content.
              const newItemInState = cartState.items.find(item =>
                  item.StyleNumber === productData.styleNumber &&
                  item.Color === productData.color &&
                  item.ImprintType === productData.embellishmentType &&
                  item.CartStatus === 'Active' &&
                  // Add a check to ensure it has sizes matching what we intended to add (or is missing sizes initially)
                  // This helps differentiate if multiple identical items were added rapidly before syncs completed.
                  // A more robust check might involve comparing EmbellishmentOptions if they are detailed.
                  // For now, assume the latest matching item without a previously known ID is the one.
                  // Or, if loadCartItems is fast, the one added most recently.
                  // Let's refine the search: find the *last* matching item in the array.
                  true // Placeholder for a potentially better matching condition if needed
              );

              // Find the last matching item
              const matchingItems = cartState.items.filter(item =>
                  item.StyleNumber === productData.styleNumber &&
                  item.Color === productData.color &&
                  item.ImprintType === productData.embellishmentType &&
                  item.CartStatus === 'Active'
              );

              if (matchingItems.length > 0) {
                  // Assume the last one in the array is the most recently added
                  extractedCartItemID = matchingItems[matchingItems.length - 1].CartItemID;
                  debugCart(`[CART:ADD] Found CartItemID ${extractedCartItemID} after reloading and searching.`);
              } else {
                  // If still not found after reload, something is wrong.
                  console.error("[CART:ADD] CRITICAL: Could not find the newly created item's CartItemID even after reloading.");
                  debugCart("ADD-ERROR", "Failed to find CartItemID after reload for item:", productData);
                  throw new Error('Failed to retrieve CartItemID for the new item after creation.');
              }
          }

          debugCart(`[CART:ADD] Using CartItemID: ${extractedCartItemID} for adding sizes.`);

          // Add sizes for the new item
          debugCart("ADD", "Adding sizes for new CartItemID:", extractedCartItemID, "Sizes:", validSizes);
          const sizes = [];
          const sizeErrors = [];

          await Promise.all(validSizes.map(async (sizeData) => {
            try {
              const sizeDataPayload = {
                CartItemID: extractedCartItemID,
                Size: sizeData.size,
                Quantity: sizeData.quantity,
                UnitPrice: sizeData.unitPrice
              };
              if (sizeData.warehouseSource) {
                sizeDataPayload.WarehouseSource = sizeData.warehouseSource;
              }
              debugCart("ADD", "Creating size on server with data:", sizeDataPayload);
              
              // Simplified: Assume single attempt is enough for now, add retries if needed
              const sizeResponse = await fetch(ENDPOINTS.cartItemSizes.create, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sizeDataPayload)
              });

              if (!sizeResponse.ok) {
                const errorText = await sizeResponse.text();
                debugCart("ADD-ERROR", `API error creating size ${sizeData.size}:`, {status: sizeResponse.status, text: errorText});
                throw new Error(`Failed to add size ${sizeData.size}: ${sizeResponse.status} ${errorText}`);
              }

              const newSize = await sizeResponse.json();
              debugCart("ADD", `API success response for size ${sizeData.size}:`, newSize);
              sizes.push(newSize);
            } catch (sizeError) {
              console.error('Error creating size:', sizeError);
              sizeErrors.push(sizeError.message);
            }
          }));

          if (sizeErrors.length > 0) {
            debugCart("ADD-ERROR", "Errors occurred while adding sizes for new item", sizeErrors);
            // If sizes failed, attempt to delete the parent cart item for cleanup
            if (extractedCartItemID) {
                debugCart("ADD", "Attempting to delete cart item due to size errors:", extractedCartItemID);
                try {
                    await fetch(ENDPOINTS.cartItems.delete(extractedCartItemID), { method: 'DELETE' });
                } catch (deleteError) {
                    debugCart("ADD-WARNING", "Error deleting cart item after size errors:", deleteError);
                }
            }
            throw new Error(`Failed to add sizes for new item:\n${sizeErrors.join('\n')}`);
          }
          debugCart("ADD", "All sizes added successfully for new item");

          // Manually construct the item to add to local state temporarily
          // Note: loadCartItems() will be called later via syncWithServer() to get the definitive state
          const newItemForLocalState = {
            CartItemID: extractedCartItemID,
            SessionID: cartState.sessionId,
            ProductID: productData.productId || productData.ProductID || `${productData.styleNumber}_${productData.color}`,
            StyleNumber: productData.styleNumber,
            Color: productData.color,
            ImprintType: productData.embellishmentType,
            imageUrl: productData.imageUrl || '', // Store the specific product image URL, use empty string if missing
            ImageURL: productData.imageUrl || '', // Add uppercase version for Caspio compatibility
            PRODUCT_TITLE: productData.PRODUCT_TITLE || `${productData.styleNumber} - ${productData.color}`, // Include product title from the DOM element
            EmbellishmentOptions: productData.embellishmentOptions || {}, // Keep as object
            DateAdded: cartItemData.DateAdded, // Use the date we sent
            CartStatus: 'Active',
            sizes: sizes.map(s => ({ // Map server response size format
                 SizeItemID: s.SizeItemID,
                 CartItemID: s.CartItemID,
                 size: s.Size,
                 quantity: s.Quantity,
                 unitPrice: s.UnitPrice,
                 WarehouseSource: s.WarehouseSource
            }))
          };
          
          // Add to local cart state (will be overwritten/confirmed by sync)
          cartState.items.push(newItemForLocalState);
          debugCart("ADD", "Temporarily added new item to local state:", newItemForLocalState);
      }

      // --- Common Logic (After Update or Create) ---
      
      // Recalculate prices based on the potentially updated total quantity
      try {
          if (typeof window.recalculatePricesForEmbellishmentType === 'function') {
              debugCart("ADD", `Recalculating prices for ${productData.embellishmentType} after add/update`);
              await window.recalculatePricesForEmbellishmentType(productData.embellishmentType);
          } else {
              debugCart("ADD-WARN", "recalculatePricesForEmbellishmentType function not available");
          }
        
        // Dispatch event for cart item added/updated
        const event = new CustomEvent('cartItemAdded', { // Keep same event name for simplicity
          detail: {
            embellishmentType: productData.embellishmentType,
            styleNumber: productData.styleNumber,
            color: productData.color,
            updatedExisting: existingItemIndex > -1 // Add flag indicating if it was an update
          }
        });
        window.dispatchEvent(event);
        debugCart("ADD", "Dispatched cartItemAdded event");

      } catch (recalcError) {
        debugCart("ADD-ERROR", "Error recalculating prices:", recalcError);
        // Continue even if recalculation fails, but log it
        console.error("Error recalculating prices after cart update:", recalcError);
      }
      
      // Sync with the server to ensure local state matches DB after all operations
      try {
          debugCart("ADD", "Syncing with server after add/update operation...");
          await syncWithServer(); // This calls loadCartItems internally if needed
          debugCart("ADD", "Cart synced with server after add/update operation");
      } catch (syncError) {
          console.warn("Error syncing with server after adding/updating item:", syncError);
          // Continue even if sync fails, local state might be slightly off until next sync/reload
      }

      // Save final state to localStorage
      saveToLocalStorage();
      debugCart("ADD", "Final cart state saved to localStorage");

      // Final success state
      cartState.error = null;
      cartState.loading = false;
      triggerEvent('cartUpdated');
      debugCart("ADD", "Add to cart process completed successfully, cart updated");

      return { success: true, error: null };
    } catch (error) {
      console.error('Error adding to cart:', error); // Keep console.error for visibility
      debugCart("ADD-ERROR", "Error during add to cart process:", error);
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
          // Local state updated (size removed)
          
          // Save to localStorage *before* recalculation which might depend on saved state
          saveToLocalStorage();
          
          // Recalculate prices *after* local state is saved and *before* triggering final update
          try {
            if (typeof window.recalculatePricesForEmbellishmentType === 'function') {
              debugCart("UPDATE_QTY", `Recalculating prices for ${item.ImprintType} after removing size ${size}`);
              await window.recalculatePricesForEmbellishmentType(item.ImprintType);
            } else {
              debugCart("UPDATE_QTY-WARN", "recalculatePricesForEmbellishmentType function not available when removing size");
            }
          } catch (recalcError) {
            console.error(`[CART:UPDATE_QTY] Error recalculating prices after removing size ${size}:`, recalcError);
          }
          
          // Success!
          cartState.error = null;
          cartState.loading = false;
          triggerEvent('cartUpdated'); // Final update trigger
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
            CartItemID: sizeItem.CartItemID,
            Size: sizeItem.Size,
            Quantity: quantity,
            UnitPrice: sizeItem.UnitPrice
          })
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update size quantity: ${updateResponse.status} ${errorText}`);
        }
        
        // Update local state
        item.sizes[sizeIndex].Quantity = quantity;
        
        // Save to localStorage *before* recalculation
        saveToLocalStorage();
        
        // Recalculate prices *after* local state is saved and *before* triggering final update
        try {
          if (typeof window.recalculatePricesForEmbellishmentType === 'function') {
            debugCart("UPDATE_QTY", `Recalculating prices for ${item.ImprintType} after updating quantity for size ${size}`);
            await window.recalculatePricesForEmbellishmentType(item.ImprintType);
          } else {
            debugCart("UPDATE_QTY-WARN", "recalculatePricesForEmbellishmentType function not available when updating quantity");
          }
        } catch (recalcError) {
          console.error(`[CART:UPDATE_QTY] Error recalculating prices after updating quantity for size ${size}:`, recalcError);
        }
        
        // Success!
        cartState.error = null;
        cartState.loading = false;
        triggerEvent('cartUpdated'); // Final update trigger
        
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
    console.log("Getting cart items with status:", status);
    
    // Ensure cartState.items is an array
    if (!cartState.items || !Array.isArray(cartState.items)) {
      console.log("cartState.items is not an array, initializing empty array");
      cartState.items = [];
      saveToLocalStorage();
    }
    
    if (status) {
      const filteredItems = cartState.items.filter(item => item.CartStatus === status);
      console.log(`Found ${filteredItems.length} items with status ${status}`);
      return filteredItems;
    }
    
    console.log(`Returning all ${cartState.items.length} items`);
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

  /**
   * Construct the image URL for a product
   * @param {string} styleNumber - Product style number
   * @param {string} color - Product color name/code
   * @returns {string|null} - Image URL or null if data is missing
   */
  function constructImageUrl(styleNumber, color) {
    if (!styleNumber || !color) {
      return null; // Cannot construct URL without style and color
    }
    // Basic sanitization/formatting (adjust as needed based on actual color codes)
    const formattedStyle = styleNumber.toUpperCase().trim();
    // Color codes might need specific formatting (e.g., replacing spaces, specific casing)
    // This is a guess - adjust based on observed SanMar URL patterns
    const formattedColor = color.replace(/\s+/g, '').toUpperCase().trim();
    
    // Use HTTPS for security
    // Common SanMar large image pattern - VERIFY THIS PATTERN
    return `https://www.sanmar.com/cs/images/products/large/${formattedStyle}_${formattedColor}_lrg.jpg`;
  }

  /**
   * Get the current cart state
   * @returns {Object} - Cart state
   */
  function getCartState() {
    return {
      sessionId: cartState.sessionId,
      itemCount: getCartCount(),
      totalAmount: getCartTotal(),
      items: cartState.items,
      loading: cartState.loading,
      error: cartState.error,
      lastSync: cartState.lastSync
    };
  }

  /**
   * Clear the cart
   * @returns {Promise<{success: boolean, error: string|null}>} - Result with success status and error message
   */
  async function clearCart() {
    try {
      // Reset cart state
      cartState.items = [];
      cartState.error = null;
      
      // Save to localStorage
      saveToLocalStorage();
      
      // Try to sync with server if we have a session
      if (cartState.sessionId && !cartState.sessionId.startsWith('local_')) {
        try {
          // Get all items for this session
          const response = await fetch(ENDPOINTS.cartItems.getBySession(cartState.sessionId));
          
          if (response.ok) {
            const items = await response.json();
            
            // Delete each item
            if (items && Array.isArray(items)) {
              await Promise.all(items.map(async (item) => {
                try {
                  await fetch(ENDPOINTS.cartItems.delete(item.CartItemID), {
                    method: 'DELETE'
                  });
                } catch (deleteError) {
                  console.error(`Error deleting item ${item.CartItemID}:`, deleteError);
                }
              }));
            }
          }
        } catch (syncError) {
          console.warn('Error syncing with server during clear:', syncError);
        }
      }
      
      // Trigger event
      triggerEvent('cartUpdated');
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Error clearing cart:', error);
      cartState.error = 'Failed to clear cart';
      return { success: false, error: cartState.error };
    }
  }

  /**
   * Submits the current active cart items as a quote request.
   * Updates the status of each active item to 'Submitted' via the API.
   * @returns {Promise<{success: boolean, error: string|null, failedItems: Array}>} - Result object with success status, potential error message, and list of items that failed to update.
   */
  async function submitQuoteRequest() {
    debugCart("SUBMIT_QUOTE", "Attempting to submit quote request");
    cartState.loading = true;
    triggerEvent('cartUpdated'); // Indicate loading start

    const activeItems = getCartItems('Active');
    if (activeItems.length === 0) {
      debugCart("SUBMIT_QUOTE", "No active items to submit.");
      cartState.loading = false;
      triggerEvent('cartUpdated');
      return { success: true, error: null, failedItems: [] }; // Nothing to submit
    }

    const updatePromises = activeItems.map(item => {
      const itemId = item.CartItemID;
      const updateUrl = `${ENDPOINTS.cartItems}/${itemId}`; // Assumes ENDPOINTS.cartItems is the base URL like '/api/cart-items'
      const payload = { QuoteStatus: 'Submitted' }; // Assumes a 'QuoteStatus' field exists

      debugCart("SUBMIT_QUOTE", `Updating item ${itemId} status to Submitted`, { url: updateUrl, payload });

      return fetch(updateUrl, {
        method: 'PUT', // Or PATCH, depending on your API design
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': cartState.sessionId
        },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            const errorMsg = `Failed to update item ${itemId} (${item.StyleNumber}): ${response.status} ${text}`;
            console.error("[CART] Submit Quote Error:", errorMsg);
            return { status: 'rejected', reason: errorMsg, itemId: itemId }; 
          });
        }
        debugCart("SUBMIT_QUOTE", `Successfully updated item ${itemId}`);
        return { status: 'fulfilled', value: { itemId: itemId, success: true } };
      })
      .catch(error => {
        const errorMsg = `Network error updating item ${itemId}: ${error.message}`;
        console.error("[CART] Submit Quote Network Error:", errorMsg);
        return { status: 'rejected', reason: errorMsg, itemId: itemId };
      });
    });

    const results = await Promise.all(updatePromises);

    const failedItems = results.filter(result => result.status === 'rejected');
    const successfullyUpdatedIds = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value.itemId);

    if (failedItems.length > 0) {
      const errorMessages = failedItems.map(f => f.reason).join('; ');
      cartState.error = `Failed to submit some items: ${errorMessages}`;
      debugCart("SUBMIT_QUOTE_ERROR", `Submission failed for ${failedItems.length} items.`, { errors: errorMessages });
      cartState.loading = false;
      triggerEvent('cartUpdated');
      return { success: false, error: cartState.error, failedItems: failedItems.map(f => f.itemId) };
    }

    // All items updated successfully
    debugCart("SUBMIT_QUOTE_SUCCESS", "All active items successfully marked as Submitted.");

    // Option 1: Remove submitted items from local cart
    cartState.items = cartState.items.filter(item => item.CartStatus !== 'Active');
    
    // Option 2: Change local status (if you want to show them differently)
    // cartState.items.forEach(item => {
    //   if (successfullyUpdatedIds.includes(item.CartItemID)) {
    //     item.CartStatus = 'Submitted'; // Or a different status like 'PendingQuote'
    //   }
    // });

    cartState.error = null;
    cartState.loading = false;
    saveToLocalStorage();
    triggerEvent('cartUpdated');

    return { success: true, error: null, failedItems: [] };
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
    getError: () => cartState.error,
    getCartState, // Add the getCartState method to the public API
    clearCart, // Add the clearCart method to the public API
    submitQuoteRequest, // Expose the new function
    isInitialized: false, // Flag to indicate if cart has been initialized
    recalculatePrices: async function(embellishmentType) {
      // Call the recalculate function if available
      if (typeof window.recalculatePricesForEmbellishmentType === 'function') {
        return await window.recalculatePricesForEmbellishmentType(embellishmentType);
      } else {
        console.warn("recalculatePricesForEmbellishmentType function not available");
        return false;
      }
    }
  };
  })();

  /**
   * Function to remove any test buttons that might be in the DOM
   */
  function removeTestButton() {
    const testButton = document.querySelector('button[onclick="testDirectApiCall()"]');
    if (testButton) {
      testButton.remove();
    }
  }

  // Initialize cart when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing NWCACart");
    window.NWCACart.initializeCart();
    
    // Update cart count in header (if element exists)
    const updateCartCount = function() {
      const cartCountElement = document.getElementById('cart-count');
      if (cartCountElement) {
        cartCountElement.textContent = window.NWCACart.getCartCount();
      }
      
      // Also update cart count in the header View Cart button
      const headerCartCountElement = document.getElementById('cart-item-count-header');
      if (headerCartCountElement) {
        headerCartCountElement.textContent = window.NWCACart.getCartCount();
      }
      
      // Update any other elements with the cart-count-display class
      const cartCountDisplayElements = document.querySelectorAll('.cart-count-display');
      if (cartCountDisplayElements.length > 0) {
        const count = window.NWCACart.getCartCount();
        cartCountDisplayElements.forEach(element => {
          element.textContent = count;
        });
      }
    };
    
    // Listen for cart updates
    window.NWCACart.addEventListener('cartUpdated', updateCartCount);
    
    // Initial update
    updateCartCount();
    
    // Remove any test buttons that might be in the DOM
    removeTestButton();
  });
} else {
  console.log("NWCACart already defined, skipping initialization");
}

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