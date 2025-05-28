// pricing-calculator.js - Calculates product prices based on quantity, tiers, and LTM fees.

console.log("[PRICING-CALC:LOAD] Pricing calculator module loaded.");

(function() {
    "use strict";

    const LTM_FEE_AMOUNT = 50.00; // Standard LTM fee
    const LTM_THRESHOLD = 24; // Minimum quantity to avoid LTM fee

    /**
     * Calculates pricing details for a set of items based on quantity and pricing data.
     * @param {Object} sizeQuantities - Object mapping size to quantity for items being added *now*. e.g., { 'S': 2, 'L': 5 }
     * @param {number} existingCartQuantity - Quantity of items of the *same embellishment type* already in the cart.
     * @param {Object} pricingData - The pricing data object (e.g., from window.nwcaPricingData). Expected format:
     *                               { prices: { size: { tier: price } }, tierData: { tier: { MinQuantity, MaxQuantity, LTM_Fee } } }
     * @returns {Object|null} An object containing calculated pricing details, or null if calculation fails.
     *                        {
     *                            tierKey: string, // The calculated pricing tier key
     *                            ltmFeeApplies: boolean, // Whether LTM fee is applied
     *                            ltmFeeTotal: number, // Total LTM fee amount (e.g., 50.00)
     *                            ltmFeePerItem: number, // LTM fee distributed per item
     *                            combinedQuantity: number, // Total quantity used for tier calculation (new + existing)
     *                            items: { size: { quantity, baseUnitPrice, displayUnitPrice, itemTotal, ltmFeeAmount } }, // Details for each size being added
     *                            totalPrice: number, // Total price for the items being added *now* (including LTM)
     *                            nextTier: string|null, // Key of the next pricing tier
     *                            quantityForNextTier: number // Items needed to reach the next tier
     *                        }
     */
    function calculatePricing(sizeQuantities, existingCartQuantity, pricingData) {
        console.log("[PRICING-CALC:CALC] Calculating pricing...");
        console.log("[PRICING-CALC:INPUT] Size Quantities:", JSON.parse(JSON.stringify(sizeQuantities || {})));
        console.log("[PRICING-CALC:INPUT] Existing Cart Qty:", existingCartQuantity);
        
        // Detailed debugging for pricingData
        console.log("[PRICING-CALC:DEBUG] Raw pricingData object received:", pricingData);
        if (typeof pricingData === 'object' && pricingData !== null) {
            console.log("[PRICING-CALC:DEBUG] pricingData is an object.");
            console.log("[PRICING-CALC:DEBUG] Keys in pricingData:", Object.keys(pricingData));
            console.log("[PRICING-CALC:DEBUG] pricingData.prices exists:", pricingData.hasOwnProperty('prices'));
            console.log("[PRICING-CALC:DEBUG] pricingData.tierData exists:", pricingData.hasOwnProperty('tierData'));
            if (pricingData.hasOwnProperty('prices')) {
                console.log("[PRICING-CALC:DEBUG] typeof pricingData.prices:", typeof pricingData.prices);
                console.log("[PRICING-CALC:DEBUG] pricingData.prices content (first few keys):", pricingData.prices ? JSON.stringify(Object.keys(pricingData.prices).slice(0,5)) : 'null/undefined');
            }
            if (pricingData.hasOwnProperty('tierData')) {
                console.log("[PRICING-CALC:DEBUG] typeof pricingData.tierData:", typeof pricingData.tierData);
                console.log("[PRICING-CALC:DEBUG] pricingData.tierData content (first few keys):", pricingData.tierData ? JSON.stringify(Object.keys(pricingData.tierData).slice(0,5)) : 'null/undefined');
            }
        } else {
            console.log("[PRICING-CALC:DEBUG] pricingData is NOT a valid object or is null/undefined. Type:", typeof pricingData);
        }

        if (!pricingData || !pricingData.prices || !pricingData.tierData) {
            // Added embellishmentType to the error for more context
            const embType = pricingData && pricingData.embellishmentType ? pricingData.embellishmentType : 'unknown';
            console.error(`[PRICING-CALC:ERROR] Invalid or missing pricingData object, or missing 'prices'/'tierData' properties for embellishment type: ${embType}.`);
            return null;
        }

        const newQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
        const combinedQuantity = newQuantity + (parseInt(existingCartQuantity) || 0);

        console.log(`[PRICING-CALC:QTY] New: ${newQuantity}, Existing: ${existingCartQuantity}, Combined: ${combinedQuantity}`);

        let tierKey = '';
        let ltmFeeApplies = false;
        let ltmFeeTotal = 0;
        let ltmFeePerItem = 0;
        let nextTier = null;
        let quantityForNextTier = 0;
        let ltmReferenceTier = null; // The tier used for base price when LTM applies

        const tierData = pricingData.tierData;
        const groupedPrices = pricingData.prices;

        if (!tierData || Object.keys(tierData).length === 0) {
             console.error("[PRICING-CALC:ERROR] Tier data is missing or empty.");
             return null;
        }
         if (!groupedPrices || Object.keys(groupedPrices).length === 0) {
             console.error("[PRICING-CALC:ERROR] Grouped price data is missing or empty.");
             return null;
         }

        // Sort tiers by minimum quantity to ensure correct matching
        const sortedTiers = Object.keys(tierData).sort((a, b) => (tierData[a].MinQuantity || 0) - (tierData[b].MinQuantity || 0));

        // Find the correct tier based on combined quantity
        for (let i = 0; i < sortedTiers.length; i++) {
            const currentTierName = sortedTiers[i];
            const currentTierInfo = tierData[currentTierName];
            const minQty = currentTierInfo.MinQuantity || 0;
            const maxQty = currentTierInfo.MaxQuantity; // Can be undefined

            if (combinedQuantity >= minQty && (maxQty === undefined || combinedQuantity <= maxQty)) {
                tierKey = currentTierName;
                // Determine next tier info
                if (i < sortedTiers.length - 1) {
                    nextTier = sortedTiers[i + 1];
                    quantityForNextTier = (tierData[nextTier].MinQuantity || 0) - combinedQuantity;
                }
                break; // Found the tier
            }
        }

        // Fallback to lowest tier if no exact match (e.g., quantity is 0 but we need a tier)
         if (!tierKey && sortedTiers.length > 0) {
             tierKey = sortedTiers[0];
              if (sortedTiers.length > 1) {
                 nextTier = sortedTiers[1];
                 quantityForNextTier = (tierData[nextTier].MinQuantity || 0) - combinedQuantity;
             }
             console.warn(`[PRICING-CALC:TIER] No exact tier match for quantity ${combinedQuantity}. Falling back to lowest tier: ${tierKey}`);
         }


        if (!tierKey) {
             console.error("[PRICING-CALC:ERROR] Could not determine pricing tier.");
             return null; // Cannot proceed without a tier
        }

        console.log(`[PRICING-CALC:TIER] Determined Tier: ${tierKey}`);

        // Determine LTM fee application
        if (combinedQuantity > 0 && combinedQuantity < LTM_THRESHOLD) {
            ltmFeeApplies = true;
            // Find the LTM fee amount from the *matched* tier, or use default
            const matchedTierInfo = tierData[tierKey];
            ltmFeeTotal = (matchedTierInfo && matchedTierInfo.LTM_Fee !== undefined) ? matchedTierInfo.LTM_Fee : LTM_FEE_AMOUNT;
            ltmFeePerItem = combinedQuantity > 0 ? (ltmFeeTotal / combinedQuantity) : 0;

            // Determine the reference tier for base pricing (usually the tier containing LTM_THRESHOLD)
            ltmReferenceTier = Object.keys(tierData).find(t => {
                 const td = tierData[t];
                 return (td.MinQuantity || 0) <= LTM_THRESHOLD && (td.MaxQuantity === undefined || td.MaxQuantity >= LTM_THRESHOLD);
            }) || tierKey; // Fallback to current tier if threshold tier not found

            console.log(`[PRICING-CALC:LTM] LTM Applies. Fee: $${ltmFeeTotal.toFixed(2)}, Per Item: $${ltmFeePerItem.toFixed(2)}, Base Tier: ${ltmReferenceTier}`);
        }

        // Calculate prices for each item being added
        const calculatedItems = {};
        let overallTotalPrice = 0;

        for (const size in sizeQuantities) {
            const quantity = parseInt(sizeQuantities[size]) || 0;
            if (quantity <= 0) continue; // Only calculate for items being added

            let baseUnitPrice = 0;
            const pricingTierForLookup = ltmFeeApplies ? ltmReferenceTier : tierKey;

            // Find base price
            if (groupedPrices[size] && groupedPrices[size][pricingTierForLookup] !== undefined) {
                baseUnitPrice = parseFloat(groupedPrices[size][pricingTierForLookup]);
            } else if (size === 'OSFA' && groupedPrices['OSFA'] && groupedPrices['OSFA'][pricingTierForLookup] !== undefined) {
                 baseUnitPrice = parseFloat(groupedPrices['OSFA'][pricingTierForLookup]); // OSFA fallback
            } else {
                console.warn(`[PRICING-CALC:PRICE] Price not found for Size: ${size}, Tier: ${pricingTierForLookup}. Using 0.`);
                baseUnitPrice = 0; // Or handle error more explicitly
            }

            baseUnitPrice = isNaN(baseUnitPrice) ? 0 : baseUnitPrice; // Ensure it's a number

            const displayUnitPrice = baseUnitPrice + (ltmFeeApplies ? ltmFeePerItem : 0);
            const itemTotal = quantity * displayUnitPrice;
            const ltmFeeAmountForItem = ltmFeeApplies ? (ltmFeePerItem * quantity) : 0;

            calculatedItems[size] = {
                quantity: quantity,
                baseUnitPrice: baseUnitPrice,
                displayUnitPrice: displayUnitPrice,
                itemTotal: itemTotal,
                ltmFeeAmount: ltmFeeAmountForItem
            };

            overallTotalPrice += itemTotal;
        }

        const result = {
            tierKey: tierKey,
            ltmFeeApplies: ltmFeeApplies,
            ltmFeeTotal: ltmFeeTotal,
            ltmFeePerItem: ltmFeePerItem,
            combinedQuantity: combinedQuantity,
            items: calculatedItems,
            // totalPrice is the sum of item totals, where each itemTotal includes distributed LTM if applicable.
            totalPrice: overallTotalPrice,
            nextTier: nextTier,
            quantityForNextTier: quantityForNextTier > 0 ? quantityForNextTier : 0,
             // Include base prices for all available sizes, even if quantity is 0, for UI updates
             baseUnitPrices: {}
        };

         // Populate baseUnitPrices for all available sizes in the pricing data
         const allSizes = Object.keys(groupedPrices);
         allSizes.forEach(size => {
             const pricingTierForLookup = ltmFeeApplies ? ltmReferenceTier : tierKey;
             let basePrice = 0;
             if (groupedPrices[size] && groupedPrices[size][pricingTierForLookup] !== undefined) {
                 basePrice = parseFloat(groupedPrices[size][pricingTierForLookup]);
             } else if (size === 'OSFA' && groupedPrices['OSFA'] && groupedPrices['OSFA'][pricingTierForLookup] !== undefined) {
                 basePrice = parseFloat(groupedPrices['OSFA'][pricingTierForLookup]);
             }
             result.baseUnitPrices[size] = isNaN(basePrice) ? 0 : basePrice;
         });


        console.log(`[PRICING-CALC:FINAL_SUM_RULE_B] overallTotalPrice (sum of item totals with distributed LTM): ${overallTotalPrice}, ltmFeeApplies: ${ltmFeeApplies}, ltmFeeTotal (flat fee, not added to this totalPrice): ${ltmFeeTotal}, Final result.totalPrice: ${result.totalPrice}`);
        console.log("[PRICING-CALC:RESULT]", result);
        return result;
    }

    // Expose the calculator function
    window.NWCAPricingCalculator = {
        calculatePricing: calculatePricing
    };

})();