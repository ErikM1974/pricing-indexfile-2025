// pricing-calculator.js - Calculates product prices based on quantity, tiers, and LTM fees.
// Version 2.0 - Standardized to use pricingData.prices and pricingData.tierData

console.log("[PRICING-CALC:LOAD] Pricing calculator module loaded (v2.0 - Standardized).");

(function() {
    "use strict";

    const LTM_FEE_AMOUNT = 50.00; // Standard LTM fee
    const LTM_THRESHOLD = 24;    // Minimum quantity to avoid LTM fee (example, can be overridden by tierData)

    /**
     * Calculates pricing details for a set of items based on quantity and pricing data.
     * @param {Object} sizeQuantities - Object mapping size to quantity for items being added *now*. e.g., { 'S': 2, 'L': 5 }
     * @param {number} existingCartQuantity - Quantity of items of the *same embellishment type* already in the cart.
     * @param {Object} pricingData - The pricing data object. Expected format:
     *                               {
     *                                 prices: { size: { tierKey: price } }, // e.g., prices.S['12-23'] = 10.00
     *                                 tierData: { tierKey: { MinQuantity, MaxQuantity, LTM_Fee (optional) } }, // e.g., tierData['12-23'] = { MinQuantity:12, MaxQuantity:23, LTM_Fee:50 }
     *                                 embellishmentType: string (optional, for logging)
     *                                 fees: { setup: number, flash: number } (optional, for screen-print specific fees)
     *                               }
     * @returns {Object|null} An object containing calculated pricing details, or null if calculation fails.
     */
    function calculatePricing(sizeQuantities, existingCartQuantity, pricingData) {
        console.log("[PRICING-CALC:CALC] Calculating pricing (v2.0)...");
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
                console.log("[PRICING-CALC:DEBUG] typeof pricingData.prices:", typeof pricingData.prices, "Is Array:", Array.isArray(pricingData.prices));
                console.log("[PRICING-CALC:DEBUG] pricingData.prices content (first few keys):", pricingData.prices ? JSON.stringify(Object.keys(pricingData.prices).slice(0,5)) : 'null/undefined');
            }
            if (pricingData.hasOwnProperty('tierData')) {
                console.log("[PRICING-CALC:DEBUG] typeof pricingData.tierData:", typeof pricingData.tierData, "Is Array:", Array.isArray(pricingData.tierData));
                console.log("[PRICING-CALC:DEBUG] pricingData.tierData content (first few keys):", pricingData.tierData ? JSON.stringify(Object.keys(pricingData.tierData).slice(0,5)) : 'null/undefined');
            }
        } else {
            console.log("[PRICING-CALC:DEBUG] pricingData is NOT a valid object or is null/undefined. Type:", typeof pricingData);
        }

        if (!pricingData || typeof pricingData.prices !== 'object' || Array.isArray(pricingData.prices) || typeof pricingData.tierData !== 'object' || Array.isArray(pricingData.tierData)) {
            const embType = pricingData && pricingData.embellishmentType ? pricingData.embellishmentType : 'unknown';
            console.error(`[PRICING-CALC:ERROR] Invalid pricingData structure for ${embType}. Expected 'prices' and 'tierData' to be objects. Got prices type: ${typeof pricingData.prices}, tierData type: ${typeof pricingData.tierData}`);
            return null;
        }

        const newQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
        const combinedQuantity = newQuantity + (parseInt(existingCartQuantity) || 0);

        console.log(`[PRICING-CALC:QTY] New: ${newQuantity}, Existing: ${existingCartQuantity}, Combined: ${combinedQuantity}`);

        let tierKey = '';
        let currentTierObject = null;
        let nextTierDetails = { tier: null, quantityNeeded: 0 };
        let ltmReferenceTierKey = null;

        const tierData = pricingData.tierData;
        const allTierKeys = Object.keys(tierData).sort((a, b) => (tierData[a].MinQuantity || 0) - (tierData[b].MinQuantity || 0));

        for (let i = 0; i < allTierKeys.length; i++) {
            const currentKey = allTierKeys[i];
            const tierInfo = tierData[currentKey];
            const minQty = tierInfo.MinQuantity || 0;
            const maxQty = tierInfo.MaxQuantity;

            if (combinedQuantity >= minQty && (maxQty === undefined || combinedQuantity <= maxQty)) {
                tierKey = currentKey;
                currentTierObject = tierInfo;
                if (i < allTierKeys.length - 1) {
                    const nextKey = allTierKeys[i+1];
                    nextTierDetails.tier = tierData[nextKey];
                    nextTierDetails.tier.label = nextKey; // Ensure label is on nextTierDetails.tier
                    nextTierDetails.quantityNeeded = (tierData[nextKey].MinQuantity || 0) - combinedQuantity;
                }
                break;
            }
        }
        
        if (!tierKey && allTierKeys.length > 0) {
            tierKey = allTierKeys[0]; // Fallback to the lowest tier
            currentTierObject = tierData[tierKey];
            if (allTierKeys.length > 1) {
                 const nextKey = allTierKeys[1];
                 nextTierDetails.tier = tierData[nextKey];
                 nextTierDetails.tier.label = nextKey;
                 nextTierDetails.quantityNeeded = (tierData[nextKey].MinQuantity || 0) - combinedQuantity;
            }
            console.warn(`[PRICING-CALC:TIER] No exact tier match for quantity ${combinedQuantity}. Falling back to lowest tier: ${tierKey}`);
        }

        if (!tierKey || !currentTierObject) {
            console.error("[PRICING-CALC:ERROR] Could not determine pricing tier for quantity:", combinedQuantity);
            return null;
        }
        console.log(`[PRICING-CALC:TIER] Determined Tier: ${tierKey}`, currentTierObject);

        const ltmThresholdForProduct = currentTierObject.LTM_Threshold || LTM_THRESHOLD; // Tier specific or default
        const ltmFeeApplies = combinedQuantity > 0 && combinedQuantity < ltmThresholdForProduct;
        const ltmFeeFromTier = currentTierObject.LTM_Fee !== undefined ? currentTierObject.LTM_Fee : (pricingData.fees && pricingData.fees.ltm !== undefined ? pricingData.fees.ltm : LTM_FEE_AMOUNT);
        const ltmFeeTotal = ltmFeeApplies ? parseFloat(ltmFeeFromTier) : 0;
        const ltmFeePerItem = ltmFeeApplies && combinedQuantity > 0 ? (ltmFeeTotal / combinedQuantity) : 0;

        // Determine the reference tier for LTM base pricing (usually the tier containing LTM_THRESHOLD)
        ltmReferenceTierKey = allTierKeys.find(tKey => {
            const td = tierData[tKey];
            return (td.MinQuantity || 0) <= ltmThresholdForProduct && (td.MaxQuantity === undefined || td.MaxQuantity >= ltmThresholdForProduct);
        }) || tierKey; // Fallback to current tier if threshold tier not found

        console.log(`[PRICING-CALC:LTM] LTM Applies: ${ltmFeeApplies}, Fee: $${ltmFeeTotal.toFixed(2)}, Per Item: $${ltmFeePerItem.toFixed(2)}, Base Tier for LTM Price: ${ltmReferenceTierKey}`);

        const calculatedItems = {};
        let overallTotalPrice = 0;
        
        // Screen print specific fees (optional, from pricingData.fees)
        const setupFee = (pricingData.fees && typeof pricingData.fees.setup === 'number') ? pricingData.fees.setup : 0;
        const flashChargePerItem = (pricingData.fees && typeof pricingData.fees.flash === 'number') ? pricingData.fees.flash : 0;
        let totalFlashChargeForOrder = 0;

        console.log(`[PRICING-CALC:FEES] Setup Fee (overall): $${setupFee.toFixed(2)}, Flash Charge (per item): $${flashChargePerItem.toFixed(2)}`);

        for (const size in sizeQuantities) {
            const quantity = parseInt(sizeQuantities[size]) || 0;
            if (quantity <= 0) continue;

            let baseUnitPrice = 0;
            const pricingTierForLookup = ltmFeeApplies ? ltmReferenceTierKey : tierKey;

            if (pricingData.prices[size] && pricingData.prices[size][pricingTierForLookup] !== undefined) {
                baseUnitPrice = parseFloat(pricingData.prices[size][pricingTierForLookup]);
            } else if (pricingData.prices['OSFA'] && pricingData.prices['OSFA'][pricingTierForLookup] !== undefined) { // OSFA fallback
                 baseUnitPrice = parseFloat(pricingData.prices['OSFA'][pricingTierForLookup]);
            } else {
                console.warn(`[PRICING-CALC:PRICE] Price not found for Size: ${size}, Tier: ${pricingTierForLookup}. Using 0.`);
            }
            baseUnitPrice = isNaN(baseUnitPrice) ? 0 : baseUnitPrice;

            const itemFlashChargeTotal = quantity * flashChargePerItem;
            totalFlashChargeForOrder += itemFlashChargeTotal;
            
            // Check for back logo pricing (cap embroidery specific)
            let backLogoPerItem = 0;
            if (pricingData.embellishmentType === 'cap-embroidery' && window.CapEmbroideryBackLogo && window.CapEmbroideryBackLogo.isEnabled()) {
                backLogoPerItem = window.CapEmbroideryBackLogo.getPrice();
                console.log(`[PRICING-CALC:BACK-LOGO] Back logo enabled, adding $${backLogoPerItem} per item`);
            }
            
            // Display unit price includes per-item LTM, per-item flash charge, and back logo
            const displayUnitPrice = baseUnitPrice + ltmFeePerItem + flashChargePerItem + backLogoPerItem;
            const itemTotal = quantity * displayUnitPrice; // This total already includes distributed LTM, flash, and back logo for these items

            calculatedItems[size] = {
                quantity: quantity,
                baseUnitPrice: baseUnitPrice,
                displayUnitPrice: displayUnitPrice,
                itemTotal: itemTotal,
                ltmFeeAmount: ltmFeePerItem * quantity, // Portion of LTM for this size/qty
                flashChargeAmount: itemFlashChargeTotal // Portion of flash for this size/qty
            };
            overallTotalPrice += itemTotal;
        }

        overallTotalPrice += setupFee; // Add one-time setup fee

        const result = {
            tierKey: tierKey,
            tierObject: currentTierObject,
            ltmFeeApplies: ltmFeeApplies,
            ltmFeeTotal: ltmFeeTotal,
            ltmFeePerItem: ltmFeePerItem,
            setupFee: setupFee, // Total setup fee for the order/configuration
            flashCharge: totalFlashChargeForOrder, // Total flash charge for items being added
            combinedQuantity: combinedQuantity,
            items: calculatedItems,
            totalPrice: overallTotalPrice,
            nextTierDetails: nextTierDetails.tier ? {
                tier: nextTierDetails.tier, // Contains label, minQty etc.
                quantityNeeded: nextTierDetails.quantityNeeded > 0 ? nextTierDetails.quantityNeeded : 0
            } : null,
            baseUnitPrices: {} // Populated below
        };

        const allSizesFromPricingData = Object.keys(pricingData.prices);
        allSizesFromPricingData.forEach(size => {
            const pricingTierForLookup = ltmFeeApplies ? ltmReferenceTierKey : tierKey;
            let basePrice = 0;
            if (pricingData.prices[size] && pricingData.prices[size][pricingTierForLookup] !== undefined) {
                basePrice = parseFloat(pricingData.prices[size][pricingTierForLookup]);
            } else if (pricingData.prices['OSFA'] && pricingData.prices['OSFA'][pricingTierForLookup] !== undefined) {
                basePrice = parseFloat(pricingData.prices['OSFA'][pricingTierForLookup]);
            }
            result.baseUnitPrices[size] = isNaN(basePrice) ? 0 : basePrice;
        });

        console.log("[PRICING-CALC:RESULT] (v2.0)", result);
        return result;
    }

    window.NWCAPricingCalculator = {
        calculatePricing: calculatePricing
    };

})();