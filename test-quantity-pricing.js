// test-quantity-pricing.js - Test script for quantity pricing in the cart
console.log("Starting quantity pricing tests...");

// Mock data for testing
const mockPricingData = {
    "embroidery": {
        "J790": {
            "Black/Chrome": {
                "rows": [
                    {
                        "tier": "1-23",
                        "prices": {
                            "XS-XL": 63.00,
                            "2XL": 67.00,
                            "3XL": 68.00,
                            "4XL": 70.00
                        }
                    },
                    {
                        "tier": "24-47",
                        "prices": {
                            "XS-XL": 62.00,
                            "2XL": 66.00,
                            "3XL": 67.00,
                            "4XL": 69.00
                        }
                    },
                    {
                        "tier": "48-71",
                        "prices": {
                            "XS-XL": 61.00,
                            "2XL": 65.00,
                            "3XL": 66.00,
                            "4XL": 68.00
                        }
                    },
                    {
                        "tier": "72+",
                        "prices": {
                            "XS-XL": 60.00,
                            "2XL": 64.00,
                            "3XL": 65.00,
                            "4XL": 67.00
                        }
                    }
                ]
            }
        },
        "PC61": {
            "Jet Black": {
                "rows": [
                    {
                        "tier": "1-23",
                        "prices": {
                            "XS-XL": 38.00,
                            "2XL": 41.00,
                            "3XL-4XL": 45.00
                        }
                    },
                    {
                        "tier": "24-47",
                        "prices": {
                            "XS-XL": 37.00,
                            "2XL": 40.00,
                            "3XL-4XL": 44.00
                        }
                    },
                    {
                        "tier": "48-71",
                        "prices": {
                            "XS-XL": 36.00,
                            "2XL": 39.00,
                            "3XL-4XL": 43.00
                        }
                    },
                    {
                        "tier": "72+",
                        "prices": {
                            "XS-XL": 35.00,
                            "2XL": 38.00,
                            "3XL-4XL": 42.00
                        }
                    }
                ]
            }
        }
    }
};

// Mock cart items
let mockCart = [];

// Mock PricingMatrix API
const PricingMatrix = {
    getPricingData: (styleNumber, color, embellishmentType) => {
        console.log(`[MOCK] Getting pricing data for ${styleNumber}, ${color}, ${embellishmentType}`);
        try {
            return mockPricingData[embellishmentType][styleNumber][color];
        } catch (error) {
            console.error(`[MOCK] Error getting pricing data: ${error.message}`);
            return null;
        }
    }
};

// Mock NWCACart
const NWCACart = {
    getCartItems: (status = 'Active') => {
        console.log(`[MOCK] Getting cart items with status: ${status}`);
        return mockCart.filter(item => item.CartStatus === status);
    },
    addToCart: (productData) => {
        console.log(`[MOCK] Adding to cart: ${productData.styleNumber}, ${productData.color}, ${productData.embellishmentType}`);
        
        // Create cart item
        const cartItem = {
            CartItemID: mockCart.length + 1,
            SessionID: 'mock-session',
            ProductID: `${productData.styleNumber}_${productData.color}`,
            StyleNumber: productData.styleNumber,
            Color: productData.color,
            ImprintType: productData.embellishmentType,
            CartStatus: 'Active',
            DateAdded: new Date().toISOString(),
            sizes: []
        };
        
        // Add sizes
        productData.sizes.forEach(sizeData => {
            cartItem.sizes.push({
                SizeItemID: Math.floor(Math.random() * 1000),
                CartItemID: cartItem.CartItemID,
                Size: sizeData.size,
                Quantity: sizeData.quantity,
                UnitPrice: sizeData.unitPrice
            });
        });
        
        mockCart.push(cartItem);
        return { success: true };
    },
    clearCart: () => {
        console.log('[MOCK] Clearing cart');
        mockCart = [];
        return { success: true };
    }
};

// Import the cart-price-recalculator.js functionality
// Since we can't directly import it, we'll reimplement the key functions here
async function recalculatePricesForEmbellishmentType(embellishmentType) {
    console.log(`[TEST] Recalculating prices for ${embellishmentType}`);
    
    try {
        // Get all active cart items
        const cartItems = NWCACart.getCartItems('Active');
        
        // Filter items by embellishment type
        const itemsOfType = cartItems.filter(item => item.ImprintType === embellishmentType);
        
        if (itemsOfType.length === 0) {
            console.log(`[TEST] No items found for embellishment type ${embellishmentType}`);
            return true;
        }
        
        // Calculate total quantity for this embellishment type
        let totalQuantity = 0;
        itemsOfType.forEach(item => {
            if (item.sizes && Array.isArray(item.sizes)) {
                item.sizes.forEach(size => {
                    totalQuantity += parseInt(size.Quantity) || 0;
                });
            }
        });
        
        console.log(`[TEST] Total quantity for ${embellishmentType}: ${totalQuantity}`);
        
        // Process all items with the same embellishment type
        for (const item of itemsOfType) {
            console.log(`[TEST] Processing item ${item.StyleNumber} ${item.Color}`);
            
            // Get pricing data for this specific item
            const pricingData = await PricingMatrix.getPricingData(
                item.StyleNumber,
                item.Color,
                item.ImprintType
            );
            
            if (pricingData) {
                // Find the appropriate quantity tier
                let tier = null;
                
                // First, try to find an exact match for the tier
                for (const row of pricingData.rows) {
                    const tierText = row.tier;
                    
                    // Parse tier ranges
                    if (tierText.includes('-')) {
                        const [min, max] = tierText.split('-').map(t => parseInt(t.trim()));
                        
                        if (totalQuantity >= min && totalQuantity <= max) {
                            tier = row;
                            break;
                        }
                    } else if (tierText.includes('+')) {
                        const min = parseInt(tierText.replace('+', '').trim());
                        
                        if (totalQuantity >= min) {
                            tier = row;
                            break;
                        }
                    } else {
                        // Single number or other format
                        const min = parseInt(tierText.trim());
                        
                        if (!isNaN(min) && totalQuantity >= min) {
                            tier = row;
                            break;
                        }
                    }
                }
                
                // If no tier found, use the lowest tier
                if (!tier && pricingData.rows.length > 0) {
                    console.log(`[TEST] No exact tier match found for quantity ${totalQuantity}, using lowest tier`);
                    
                    // Find the tier with the lowest minimum quantity
                    let lowestMin = Number.MAX_SAFE_INTEGER;
                    let lowestTier = null;
                    
                    for (const row of pricingData.rows) {
                        const tierText = row.tier;
                        let min = Number.MAX_SAFE_INTEGER;
                        
                        if (tierText.includes('-')) {
                            min = parseInt(tierText.split('-')[0].trim());
                        } else if (tierText.includes('+')) {
                            min = parseInt(tierText.replace('+', '').trim());
                        } else {
                            min = parseInt(tierText.trim());
                        }
                        
                        if (!isNaN(min) && min < lowestMin) {
                            lowestMin = min;
                            lowestTier = row;
                        }
                    }
                    
                    if (lowestTier) {
                        console.log(`[TEST] Using lowest tier: ${lowestTier.tier}`);
                        tier = lowestTier;
                    }
                }
                
                if (tier) {
                    console.log(`[TEST] Using tier ${tier.tier} for total quantity ${totalQuantity}`);
                    
                    // Update prices for this item
                    if (!item.sizes || !Array.isArray(item.sizes) || item.sizes.length === 0) {
                        continue;
                    }
                    
                    // Update prices for each size
                    for (const size of item.sizes) {
                        // Find the price for this size
                        let sizeKey = size.Size;
                        
                        // Handle size ranges (e.g., XS-XL)
                        if (!tier.prices[size.Size]) {
                            // Define size order for comparison
                            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
                            const sizeIdx = sizeOrder.indexOf(size.Size.toUpperCase());
                            
                            if (sizeIdx !== -1) {
                                for (const key in tier.prices) {
                                    if (key.includes('-')) {
                                        const [start, end] = key.split('-').map(s => s.trim().toUpperCase());
                                        const startIdx = sizeOrder.indexOf(start);
                                        const endIdx = sizeOrder.indexOf(end);
                                        
                                        if (startIdx !== -1 && endIdx !== -1 && 
                                            sizeIdx >= startIdx && sizeIdx <= endIdx) {
                                            sizeKey = key;
                                            console.log(`[TEST] Size ${size.Size} matches range ${key}`);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        
                        const price = tier.prices[sizeKey];
                        
                        if (price) {
                            console.log(`[TEST] Updating price for ${item.StyleNumber}, ${item.Color}, ${size.Size} from $${size.UnitPrice} to $${price}`);
                            
                            // Update price in cart
                            const oldPrice = size.UnitPrice;
                            size.UnitPrice = price;
                            
                            console.log(`[TEST] Price updated from $${oldPrice} to $${size.UnitPrice}`);
                        }
                    }
                }
            }
        }
        
        console.log(`[TEST] Prices recalculated successfully for ${embellishmentType}`);
        return true;
    } catch (error) {
        console.error(`[TEST] Error recalculating prices: ${error.message}`);
        return false;
    }
}

// Test scenarios
async function runTests() {
    console.log("\n=== TEST SCENARIO 1: Single item with quantity below tier threshold ===");
    await NWCACart.clearCart();
    
    // Add a single J790 item with 10 pieces (should use 1-23 tier)
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'L', quantity: 10, unitPrice: 0 } // Initial price doesn't matter
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    
    // Print cart for verification
    console.log("\nCart after recalculation:");
    printCart();
    
    console.log("\n=== TEST SCENARIO 2: Single item with quantity in second tier ===");
    await NWCACart.clearCart();
    
    // Add a single J790 item with 30 pieces (should use 24-47 tier)
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'M', quantity: 15, unitPrice: 0 },
            { size: 'L', quantity: 15, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    
    // Print cart for verification
    console.log("\nCart after recalculation:");
    printCart();
    
    console.log("\n=== TEST SCENARIO 3: Multiple items of same style with total in third tier ===");
    await NWCACart.clearCart();
    
    // Add two J790 items with total 50 pieces (should use 48-71 tier)
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'S', quantity: 20, unitPrice: 0 },
            { size: 'M', quantity: 10, unitPrice: 0 }
        ]
    });
    
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'L', quantity: 10, unitPrice: 0 },
            { size: 'XL', quantity: 10, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    
    // Print cart for verification
    console.log("\nCart after recalculation:");
    printCart();
    
    console.log("\n=== TEST SCENARIO 4: Multiple items of different styles with total in fourth tier ===");
    await NWCACart.clearCart();
    
    // Add J790 and PC61 items with total 80 pieces (should use 72+ tier)
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'S', quantity: 20, unitPrice: 0 },
            { size: 'M', quantity: 20, unitPrice: 0 }
        ]
    });
    
    await NWCACart.addToCart({
        styleNumber: 'PC61',
        color: 'Jet Black',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'L', quantity: 20, unitPrice: 0 },
            { size: 'XL', quantity: 20, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    
    // Print cart for verification
    console.log("\nCart after recalculation:");
    printCart();
    
    console.log("\n=== TEST SCENARIO 5: Mixed embellishment types ===");
    await NWCACart.clearCart();
    
    // Add embroidery and screen-print items
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'M', quantity: 10, unitPrice: 0 },
            { size: 'L', quantity: 10, unitPrice: 0 }
        ]
    });
    
    await NWCACart.addToCart({
        styleNumber: 'PC61',
        color: 'Jet Black',
        embellishmentType: 'screen-print', // Different embellishment type
        sizes: [
            { size: 'L', quantity: 30, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices for embroidery
    await recalculatePricesForEmbellishmentType('embroidery');
    
    // Print cart for verification
    console.log("\nCart after recalculation (embroidery only):");
    printCart();
    
    console.log("\n=== TEST SCENARIO 6: Adding items incrementally ===");
    await NWCACart.clearCart();
    
    // Start with 10 items (1-23 tier)
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'M', quantity: 10, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    console.log("\nCart after adding 10 items (should be 1-23 tier):");
    printCart();
    
    // Add 20 more items (total 30, should move to 24-47 tier)
    await NWCACart.addToCart({
        styleNumber: 'PC61',
        color: 'Jet Black',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'L', quantity: 20, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    console.log("\nCart after adding 20 more items (should be 24-47 tier):");
    printCart();
    
    // Add 30 more items (total 60, should move to 48-71 tier)
    await NWCACart.addToCart({
        styleNumber: 'J790',
        color: 'Black/Chrome',
        embellishmentType: 'embroidery',
        sizes: [
            { size: 'XL', quantity: 30, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    console.log("\nCart after adding 30 more items (should be 48-71 tier):");
    printCart();
    
    // Add 20 more items (total 80, should move to 72+ tier)
    await NWCACart.addToCart({
        styleNumber: 'PC61',
        color: 'Jet Black',
        embellishmentType: 'embroidery',
        sizes: [
            { size: '2XL', quantity: 20, unitPrice: 0 }
        ]
    });
    
    // Recalculate prices
    await recalculatePricesForEmbellishmentType('embroidery');
    console.log("\nCart after adding 20 more items (should be 72+ tier):");
    printCart();
}

// Helper function to print the cart contents
function printCart() {
    const cartItems = NWCACart.getCartItems();
    
    if (cartItems.length === 0) {
        console.log("Cart is empty");
        return;
    }
    
    // Calculate total quantity by embellishment type
    const quantityByType = {};
    cartItems.forEach(item => {
        if (!quantityByType[item.ImprintType]) {
            quantityByType[item.ImprintType] = 0;
        }
        
        item.sizes.forEach(size => {
            quantityByType[item.ImprintType] += parseInt(size.Quantity) || 0;
        });
    });
    
    // Print summary by embellishment type
    console.log("Embellishment Type Totals:");
    for (const [type, quantity] of Object.entries(quantityByType)) {
        console.log(`  ${type}: ${quantity} items`);
    }
    
    console.log("\nCart Items:");
    cartItems.forEach(item => {
        console.log(`- ${item.StyleNumber} ${item.Color} (${item.ImprintType}):`);
        
        let itemTotal = 0;
        let itemQuantity = 0;
        
        item.sizes.forEach(size => {
            const quantity = parseInt(size.Quantity) || 0;
            const price = parseFloat(size.UnitPrice) || 0;
            const total = quantity * price;
            
            console.log(`  * ${size.Size}: ${quantity} @ $${price.toFixed(2)} = $${total.toFixed(2)}`);
            
            itemTotal += total;
            itemQuantity += quantity;
        });
        
        console.log(`  Total: ${itemQuantity} items = $${itemTotal.toFixed(2)}`);
    });
    
    // Calculate cart total
    let cartTotal = 0;
    cartItems.forEach(item => {
        item.sizes.forEach(size => {
            const quantity = parseInt(size.Quantity) || 0;
            const price = parseFloat(size.UnitPrice) || 0;
            cartTotal += quantity * price;
        });
    });
    
    console.log(`\nCart Total: $${cartTotal.toFixed(2)}`);
}

// Run the tests
runTests().then(() => {
    console.log("\nAll tests completed!");
}).catch(error => {
    console.error("Error running tests:", error);
});