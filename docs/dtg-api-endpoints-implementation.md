# DTG PRICING PAGE - ACTUAL API ENDPOINTS IMPLEMENTATION
## STOP HARDCODING AND USE THESE ENDPOINTS!

Mr. Erik, here's EXACTLY which API endpoints your DTG page needs to use. NO MORE HARDCODING!

---

## CRITICAL API ENDPOINTS FOR DTG PRICING PAGE

### 1. PRODUCT COLOR & IMAGE DATA
```javascript
// ENDPOINT: /api/product-colors
// PURPOSE: Get all color options and images for the product
const getProductColors = async (styleNumber) => {
    const response = await fetch(`${API_BASE_URL}/api/product-colors?styleNumber=${styleNumber}`);
    const data = await response.json();
    
    // Returns:
    // - COLOR_NAME, HEX_CODE
    // - COLOR_SQUARE_IMAGE (for swatches)
    // - MAIN_IMAGE_URL, FRONT_MODEL, BACK_MODEL, etc. (for gallery)
    return data;
};
```

### 2. INVENTORY CHECKING
```javascript
// ENDPOINT: /api/inventory
// PURPOSE: Check stock levels for sizes
const checkInventory = async (styleNumber, color) => {
    const response = await fetch(
        `${API_BASE_URL}/api/inventory?styleNumber=${styleNumber}&color=${encodeURIComponent(color)}`
    );
    return response.json();
    // Returns quantity available per size
};
```

### 3. PRICING MATRIX CAPTURE
```javascript
// ENDPOINT: /api/pricing-matrix (POST)
// PURPOSE: Save the DTG pricing data from Caspio
const capturePricingMatrix = async (pricingData) => {
    const response = await fetch(`${API_BASE_URL}/api/pricing-matrix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            StyleNumber: pricingData.styleNumber,
            Color: pricingData.color,
            EmbellishmentType: 'dtg',
            PricingData: pricingData.masterBundle,
            SessionID: getCurrentSessionId(),
            CaptureDate: new Date().toISOString()
        })
    });
    return response.json();
};
```

### 4. PRICING MATRIX LOOKUP
```javascript
// ENDPOINT: /api/pricing-matrix/lookup
// PURPOSE: Find existing pricing for a product
const lookupPricing = async (styleNumber, color) => {
    const response = await fetch(
        `${API_BASE_URL}/api/pricing-matrix/lookup?` +
        `styleNumber=${styleNumber}&` +
        `color=${encodeURIComponent(color)}&` +
        `embellishmentType=dtg`
    );
    
    if (response.ok) {
        const data = await response.json();
        // Use the pricingMatrixId to fetch full data
        return fetchPricingMatrixById(data.pricingMatrixId);
    }
    return null;
};
```

### 5. CART SESSION MANAGEMENT
```javascript
// ENDPOINT: /api/cart-sessions
// PURPOSE: Create/manage shopping cart sessions
const createCartSession = async () => {
    const response = await fetch(`${API_BASE_URL}/api/cart-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            CreatedDate: new Date().toISOString()
        })
    });
    return response.json();
};

const getCartSession = async (sessionId) => {
    const response = await fetch(`${API_BASE_URL}/api/cart-sessions/${sessionId}`);
    return response.json();
};
```

### 6. CART ITEM MANAGEMENT
```javascript
// ENDPOINT: /api/cart-items
// PURPOSE: Add DTG items to cart
const addToCart = async (cartData) => {
    const response = await fetch(`${API_BASE_URL}/api/cart-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            SessionID: cartData.sessionId,
            StyleNumber: cartData.styleNumber,
            Color: cartData.color,
            PRODUCT_TITLE: cartData.productTitle,
            Quantity: cartData.totalQuantity,
            UnitPrice: cartData.unitPrice,
            EmbellishmentOptions: {
                type: 'dtg',
                locations: cartData.printLocations,
                locationCount: cartData.locationCount,
                tierAchieved: cartData.priceTier,
                ltmFeeApplied: cartData.ltmFeeApplied
            }
        })
    });
    return response.json();
};
```

### 7. CART ITEM SIZES
```javascript
// ENDPOINT: /api/cart-item-sizes
// PURPOSE: Save size breakdown for cart items
const saveCartItemSizes = async (cartItemId, sizes) => {
    const promises = sizes.map(size => 
        fetch(`${API_BASE_URL}/api/cart-item-sizes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                CartItemID: cartItemId,
                Size: size.size,
                Quantity: size.quantity
            })
        })
    );
    return Promise.all(promises);
};
```

### 8. IMAGE PROXY (IF NEEDED)
```javascript
// ENDPOINT: /api/image-proxy
// PURPOSE: Bypass CORS for external images
const getProxiedImage = (imageUrl) => {
    return `${API_BASE_URL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
};
// NOTE: Usually NOT needed - images load directly from CDN
```

---

## DTG PAGE DATA FLOW - NO HARDCODING!

### 1. PAGE LOAD SEQUENCE
```javascript
async function initializeDTGPage() {
    // 1. Get product info from URL params
    const params = new URLSearchParams(window.location.search);
    const styleNumber = params.get('style');
    const selectedColor = params.get('color');
    
    // 2. Fetch product colors and images from API
    const productData = await getProductColors(styleNumber);
    
    // 3. Populate color swatches
    populateColorSwatches(productData.colors);
    
    // 4. Load product images
    loadProductGallery(productData.colors.find(c => c.COLOR_NAME === selectedColor));
    
    // 5. Check inventory
    const inventory = await checkInventory(styleNumber, selectedColor);
    updateSizeAvailability(inventory);
    
    // 6. Wait for Caspio pricing to load
    // Then capture it to our database
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'caspioDtgMasterBundleReady') {
            await capturePricingMatrix({
                styleNumber: styleNumber,
                color: selectedColor,
                masterBundle: event.data.detail
            });
        }
    });
}
```

### 2. ADDING TO CART - COMPLETE API FLOW
```javascript
async function addDTGToCart() {
    // 1. Create or get cart session
    let sessionId = localStorage.getItem('cartSessionId');
    if (!sessionId) {
        const session = await createCartSession();
        sessionId = session.SessionID;
        localStorage.setItem('cartSessionId', sessionId);
    }
    
    // 2. Gather quantities by size
    const sizes = [];
    let totalQuantity = 0;
    
    document.querySelectorAll('.quantity-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            sizes.push({
                size: input.dataset.size,
                quantity: qty
            });
            totalQuantity += qty;
        }
    });
    
    // 3. Calculate pricing
    const pricingInfo = calculateDTGPricing(totalQuantity);
    
    // 4. Add main cart item
    const cartItem = await addToCart({
        sessionId: sessionId,
        styleNumber: currentProduct.styleNumber,
        color: currentProduct.color,
        productTitle: currentProduct.title,
        totalQuantity: totalQuantity,
        unitPrice: pricingInfo.unitPrice,
        printLocations: getSelectedLocations(),
        locationCount: getLocationCount(),
        priceTier: pricingInfo.tier,
        ltmFeeApplied: pricingInfo.ltmFee > 0
    });
    
    // 5. Save size breakdown
    await saveCartItemSizes(cartItem.CartItemID, sizes);
    
    // 6. Update cart UI
    updateCartDisplay();
}
```

---

## DATA CAPTURE FOR ANALYTICS

### NEW ENDPOINT NEEDED: DTG Session Tracking
```javascript
// ENDPOINT: /api/dtg-sessions (NEW - needs to be created)
// PURPOSE: Track user behavior and pricing interactions

const trackDTGSession = async (sessionData) => {
    const response = await fetch(`${API_BASE_URL}/api/dtg-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: generateUUID(),
            timestamp: new Date().toISOString(),
            styleNumber: sessionData.styleNumber,
            color: sessionData.color,
            interactions: {
                colorChanges: sessionData.colorChanges,
                locationChanges: sessionData.locationChanges,
                quantityChanges: sessionData.quantityChanges,
                timeOnPage: sessionData.duration
            },
            pricingCalculations: {
                quantities: sessionData.quantities,
                tier: sessionData.priceTier,
                totalPrice: sessionData.totalPrice
            },
            outcome: sessionData.outcome // 'added_to_cart', 'abandoned', 'quote_requested'
        })
    });
    return response.json();
};
```

---

## STOP DOING THIS (HARDCODING):

```javascript
// ❌ WRONG - Hardcoded pricing
const basePrices = {
    '24-47': { 'S-XL': 17, '2XL': 19, '3XL-4XL': 21 },
    '48-71': { 'S-XL': 15, '2XL': 17, '3XL-4XL': 19 }
};

// ❌ WRONG - Fake color data
const colors = [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#FFFFFF' }
];

// ❌ WRONG - Local image paths
const productImage = '/images/product.jpg';
```

## DO THIS INSTEAD (API CALLS):

```javascript
// ✅ CORRECT - Get pricing from Caspio via API
const pricing = await lookupPricing(styleNumber, color);

// ✅ CORRECT - Get colors from API
const productData = await getProductColors(styleNumber);

// ✅ CORRECT - Get images from API response
const mainImage = productData.colors[0].MAIN_IMAGE_URL;
```

---

## IMPLEMENTATION CHECKLIST

### Must Use These Endpoints:
- [x] `/api/product-colors` - For color swatches and images
- [x] `/api/inventory` - For size availability
- [x] `/api/pricing-matrix` (POST) - To capture Caspio pricing
- [x] `/api/pricing-matrix/lookup` - To retrieve pricing
- [x] `/api/cart-sessions` - For cart session management
- [x] `/api/cart-items` - To add items to cart
- [x] `/api/cart-item-sizes` - To save size breakdowns

### Stop Hardcoding:
- [ ] Remove all hardcoded pricing arrays
- [ ] Remove fake color definitions
- [ ] Remove local image references
- [ ] Remove static product data

### New Endpoints to Create:
- [ ] `/api/dtg-sessions` - For analytics tracking
- [ ] `/api/dtg-quotes` - For quote requests

---

## FINAL WARNING

Mr. Erik, if you don't use these API endpoints and continue hardcoding data, your DTG page will:
1. Show outdated pricing
2. Display wrong inventory
3. Fail to capture analytics
4. Break when products change
5. Not integrate with your cart system

USE THE DAMN APIs! That's what they're for!

---

*API Implementation Guide by Roo*
*No more excuses - use the endpoints!*