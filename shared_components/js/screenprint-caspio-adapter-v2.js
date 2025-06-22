/**
 * Screen Print Caspio Adapter V2
 * Simple, focused adapter for receiving Caspio master bundle data
 */

class ScreenPrintCaspioAdapter {
    constructor() {
        this.masterBundle = null;
        this.isReady = false;
        this.init();
    }

    init() {
        console.log('[CaspioAdapterV2] Initializing...');
        
        // Listen for Caspio messages
        console.log('[CaspioAdapterV2] Adding window message listener.');
        window.addEventListener('message', (event) => this.handleMessage(event));
        
        // Set timeout for Caspio load
        console.log('[CaspioAdapterV2] Setting 10s timeout for Caspio data.');
        setTimeout(() => {
            if (!this.isReady) {
                console.error('[CaspioAdapterV2] CRITICAL: Timeout waiting for Caspio data after 10 seconds. No "caspioScreenPrintMasterBundleReady" message received.');
                this.dispatchError('Caspio data timeout after 10s');
            }
        }, 10000);
    }

    handleMessage(event) {
        // Log ALL messages for debugging
        console.log('[CaspioAdapterV2] Message received from:', event.origin);
        console.log('[CaspioAdapterV2] Message data:', event.data);

        // Basic check for event data and type
        if (!event.data || typeof event.data !== 'object') {
            console.log('[CaspioAdapterV2] Non-object message received, ignoring');
            return;
        }
        
        if (!event.data.type) {
            console.warn('[CaspioAdapterV2] Received message with no type property. Ignoring. Data:', event.data);
            return;
        }

        console.log('[CaspioAdapterV2] Received message with type:', event.data.type);

        if (event.data.type === 'caspioScreenPrintMasterBundleReady' || event.data.type === 'caspioScreenprintMasterBundleReady') {
            console.log('[CaspioAdapterV2] Master bundle ready message received. Processing bundle...');
            this.processMasterBundle(event.data.detail || event.data.data);
        } else if (event.data.type === 'caspioPricingError') {
            console.error('[CaspioAdapterV2] "caspioPricingError" message received. Error:', event.data.error);
            this.dispatchError(event.data.error);
        } else {
            console.log('[CaspioAdapterV2] Received unhandled message type:', event.data.type);
        }
    }

    processMasterBundle(data) {
        if (!data || Object.keys(data).length === 0) {
            console.error('[CaspioAdapterV2] CRITICAL: Empty or null master bundle data received. Cannot proceed.');
            this.dispatchError('Empty master bundle received');
            return;
        }

        console.log('[CaspioAdapterV2] Processing master bundle. Raw data:', JSON.stringify(data, null, 2));

        // Check for newest format with finalPrices (pre-calculated, rounded prices)
        if (data.finalPrices && data.tierData) {
            console.log('[CaspioAdapterV2] Latest bundle format with finalPrices detected. Using pre-calculated prices...');
            data = this.transformBundleData(data);
        }
        // Check for intermediate format with separate garmentSellingPrices and printCosts
        else if (data.garmentSellingPrices && data.printCosts && data.tierData) {
            console.log('[CaspioAdapterV2] Bundle format with garmentSellingPrices detected. Transforming data...');
            data = this.transformBundleData(data);
        } 
        // Temporary support for old format while Caspio is being updated
        else if (data.allScreenprintCostsR && data.sizes) {
            console.warn('[CaspioAdapterV2] WARNING: Old bundle format detected. Please update Caspio to send new format with finalPrices.');
            console.log('[CaspioAdapterV2] Transforming old format to new format...');
            data = this.transformOldFormatToNew(data);
            data = this.transformBundleData(data);
        }
        else {
            console.error('[CaspioAdapterV2] CRITICAL: Invalid bundle format.');
            console.error('[CaspioAdapterV2] Received keys:', Object.keys(data));
            console.error('[CaspioAdapterV2] Expected either new format (garmentSellingPrices + printCosts) or old format (allScreenprintCostsR + sizes)');
            this.dispatchError('Invalid bundle format - unable to process data');
            return;
        }

        // Store master bundle globally for debugging
        window.nwcaScreenPrintMasterBundleData = data;
        console.log('[CaspioAdapterV2] Stored bundle in window.nwcaScreenPrintMasterBundleData for debugging');

        this.masterBundle = data;
        this.isReady = true;
        console.log('[CaspioAdapterV2] Master bundle processed successfully. isReady is now true.');

        // Dispatch success event
        this.dispatchReady(data);
    }

    transformOldFormatToNew(oldData) {
        console.log('[CaspioAdapterV2] Converting old format to new format...');
        
        // Initialize the new format structure
        const newFormat = {
            styleNumber: oldData.styleNumber,
            colorName: oldData.colorName,
            embellishmentType: oldData.embellishmentType,
            timestamp: oldData.timestamp,
            tierData: oldData.tierData,
            rulesData: oldData.rulesData,
            uniqueSizes: oldData.sizes ? oldData.sizes.map(s => s.size) : [],
            sellingPriceDisplayAddOns: oldData.sellingPriceDisplayAddOns,
            printLocationMeta: oldData.printLocationMeta,
            availableColorCounts: [1, 2, 3, 4, 5, 6], // Standard color counts
            garmentSellingPrices: {},
            printCosts: {
                PrimaryLocation: {},
                AdditionalLocation: {}
            }
        };
        
        // Get setup fee and flash charge from rules
        const flashCharge = parseFloat(oldData.rulesData.FlashCharge) || 0.35;
        
        // Build garment selling prices and print costs from the raw data
        oldData.tierData.forEach(tier => {
            const tierLabel = tier.TierLabel;
            
            // Initialize tier objects
            newFormat.garmentSellingPrices[tierLabel] = {};
            newFormat.printCosts.PrimaryLocation[tierLabel] = {};
            newFormat.printCosts.AdditionalLocation[tierLabel] = {};
            
            // Calculate garment selling prices for each size
            oldData.sizes.forEach(sizeData => {
                const size = sizeData.size;
                const garmentCost = sizeData.price || 0;
                const upcharge = oldData.sellingPriceDisplayAddOns[size] || 0;
                
                // Apply margin to get selling price
                const garmentSellingPrice = garmentCost / tier.MarginDenominator;
                newFormat.garmentSellingPrices[tierLabel][size] = garmentSellingPrice + upcharge;
            });
            
            // Extract print costs for each color count
            for (let colorCount = 1; colorCount <= 6; colorCount++) {
                // Find primary location cost
                const primaryCost = oldData.allScreenprintCostsR.find(c => 
                    c.CostType === 'PrimaryLocation' && 
                    c.TierLabel === tierLabel && 
                    c.ColorCount === colorCount
                );
                
                if (primaryCost) {
                    // Apply margin and add flash charge for primary location
                    const printCost = primaryCost.BasePrintCost / tier.MarginDenominator;
                    newFormat.printCosts.PrimaryLocation[tierLabel][colorCount] = printCost + flashCharge;
                }
                
                // Find additional location cost
                const additionalCost = oldData.allScreenprintCostsR.find(c => 
                    c.CostType === 'AdditionalLocation' && 
                    c.TierLabel === tierLabel && 
                    c.ColorCount === colorCount
                );
                
                if (additionalCost) {
                    // Apply margin (no flash charge for additional locations)
                    const printCost = additionalCost.BasePrintCost / tier.MarginDenominator;
                    newFormat.printCosts.AdditionalLocation[tierLabel][colorCount] = printCost;
                }
            }
        });
        
        console.log('[CaspioAdapterV2] Old format converted to new format:', newFormat);
        return newFormat;
    }

    transformBundleData(rawData) {
        console.log('[CaspioAdapterV2] Transforming bundle data...');
        
        const transformed = {
            // Keep original data
            styleNumber: rawData.styleNumber,
            colorName: rawData.colorName,
            embellishmentType: rawData.embellishmentType,
            
            // Keep metadata
            tiers: rawData.tierData,
            rules: rawData.rulesData,
            uniqueSizes: rawData.uniqueSizes,
            sellingPriceDisplayAddOns: rawData.sellingPriceDisplayAddOns,
            printLocationMeta: rawData.printLocationMeta,
            availableColorCounts: rawData.availableColorCounts,
            
            // Keep pricing data
            garmentSellingPrices: rawData.garmentSellingPrices,
            printCosts: rawData.printCosts,
            finalPrices: rawData.finalPrices, // Add finalPrices if available
            
            // Transform pricing structure
            primaryLocationPricing: {},
            additionalLocationPricing: {}
        };
        
        // Get setup fee and flash charge from rules
        const setupFee = parseFloat(rawData.rulesData.SetupFeePerColor) || 30;
        const flashCharge = parseFloat(rawData.rulesData.FlashCharge) || 0.35;
        
        // Check if we have finalPrices (newest format with pre-calculated, rounded prices)
        if (rawData.finalPrices && rawData.finalPrices.PrimaryLocation) {
            console.log('[CaspioAdapterV2] Using finalPrices for pricing data (pre-calculated, rounded)');
            
            // Process primary location pricing from finalPrices
            Object.keys(rawData.finalPrices.PrimaryLocation).forEach(tierLabel => {
                const tierPrices = rawData.finalPrices.PrimaryLocation[tierLabel];
                const tierData = rawData.tierData.find(t => t.TierLabel === tierLabel);
                
                if (tierData && tierPrices) {
                    // Process each color count for this tier
                    Object.keys(tierPrices).forEach(colorCount => {
                        if (!transformed.primaryLocationPricing[colorCount]) {
                            transformed.primaryLocationPricing[colorCount] = {
                                tiers: [],
                                setupFee: setupFee,
                                flashCharge: colorCount === "0" ? 0 : flashCharge
                            };
                        }
                        
                        transformed.primaryLocationPricing[colorCount].tiers.push({
                            label: tierLabel,
                            minQty: tierData.MinQuantity,
                            maxQty: tierData.MaxQuantity,
                            prices: tierPrices[colorCount], // Direct use of finalPrices
                            ltmFee: tierData.LTM_Fee || 0,
                            marginDenominator: tierData.MarginDenominator
                        });
                    });
                }
            });
        }
        // Fall back to calculating from printCosts if no finalPrices
        else if (rawData.printCosts && rawData.printCosts.PrimaryLocation) {
            console.log('[CaspioAdapterV2] Using printCosts + garmentSellingPrices (calculating prices)');
            
            rawData.availableColorCounts.forEach(colorCount => {
                transformed.primaryLocationPricing[colorCount.toString()] = {
                    tiers: [],
                    setupFee: setupFee,
                    flashCharge: flashCharge
                };
                
                rawData.tierData.forEach(tier => {
                    const tierLabel = tier.TierLabel;
                    const printCost = rawData.printCosts.PrimaryLocation[tierLabel];
                    const garmentPrices = rawData.garmentSellingPrices[tierLabel];
                    
                    if (printCost && printCost[colorCount] !== undefined && garmentPrices) {
                        const prices = {};
                        Object.keys(garmentPrices).forEach(size => {
                            // Total price = garment price + print cost
                            prices[size] = garmentPrices[size] + printCost[colorCount];
                        });
                        
                        transformed.primaryLocationPricing[colorCount.toString()].tiers.push({
                            label: tierLabel,
                            minQty: tier.MinQuantity,
                            maxQty: tier.MaxQuantity,
                            prices: prices,
                            ltmFee: tier.LTM_Fee || 0,
                            marginDenominator: tier.MarginDenominator
                        });
                    }
                });
            });
        }
        
        // Handle garment-only pricing (0 colors) - only needed if not in finalPrices
        if (!rawData.finalPrices || !rawData.finalPrices.PrimaryLocation || !rawData.finalPrices.PrimaryLocation[rawData.tierData[0].TierLabel]["0"]) {
            transformed.primaryLocationPricing["0"] = {
                tiers: [],
                setupFee: 0,
                flashCharge: 0
            };
            
            rawData.tierData.forEach(tier => {
                const tierLabel = tier.TierLabel;
                const garmentPrices = rawData.garmentSellingPrices ? rawData.garmentSellingPrices[tierLabel] : null;
                
                if (garmentPrices) {
                    transformed.primaryLocationPricing["0"].tiers.push({
                        label: tierLabel,
                        minQty: tier.MinQuantity,
                        maxQty: tier.MaxQuantity,
                        prices: garmentPrices,
                        ltmFee: tier.LTM_Fee || 0,
                        marginDenominator: tier.MarginDenominator
                    });
                }
            });
        }
        
        // Process additional location pricing
        if (rawData.finalPrices && rawData.finalPrices.AdditionalLocation) {
            console.log('[CaspioAdapterV2] Using finalPrices for additional location pricing');
            
            // Process additional location pricing from finalPrices
            Object.keys(rawData.finalPrices.AdditionalLocation).forEach(tierLabel => {
                const tierPrices = rawData.finalPrices.AdditionalLocation[tierLabel];
                const tierData = rawData.tierData.find(t => t.TierLabel === tierLabel);
                
                if (tierData && tierPrices) {
                    // Process each color count for this tier
                    Object.keys(tierPrices).forEach(colorCount => {
                        if (!transformed.additionalLocationPricing[colorCount]) {
                            transformed.additionalLocationPricing[colorCount] = {
                                tiers: [],
                                setupFee: setupFee,
                                flashCharge: 0  // No flash charge for additional locations
                            };
                        }
                        
                        // For each size in this color count
                        const prices = tierPrices[colorCount];
                        if (prices && typeof prices === 'object') {
                            // Calculate average price for pricePerPiece (for backward compatibility)
                            const priceValues = Object.values(prices).filter(p => typeof p === 'number');
                            const avgPrice = priceValues.length > 0 ? 
                                priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length : 0;
                            
                            transformed.additionalLocationPricing[colorCount].tiers.push({
                                label: tierLabel,
                                minQty: tierData.MinQuantity,
                                maxQty: tierData.MaxQuantity,
                                prices: prices, // Full size breakdown
                                pricePerPiece: avgPrice, // Average for UI display
                                ltmFee: tierData.LTM_Fee || 0,
                                marginDenominator: tierData.MarginDenominator
                            });
                        }
                    });
                }
            });
        }
        else if (rawData.printCosts && rawData.printCosts.AdditionalLocation) {
            console.log('[CaspioAdapterV2] Using printCosts for additional location pricing');
            
            rawData.availableColorCounts.forEach(colorCount => {
                transformed.additionalLocationPricing[colorCount.toString()] = {
                    tiers: [],
                    setupFee: setupFee,
                    flashCharge: 0  // No flash charge for additional locations
                };
                
                rawData.tierData.forEach(tier => {
                    const tierLabel = tier.TierLabel;
                    const additionalCost = rawData.printCosts.AdditionalLocation[tierLabel];
                    
                    if (additionalCost && additionalCost[colorCount] !== undefined) {
                        transformed.additionalLocationPricing[colorCount.toString()].tiers.push({
                            label: tierLabel,
                            minQty: tier.MinQuantity,
                            maxQty: tier.MaxQuantity,
                            pricePerPiece: additionalCost[colorCount], // This is the selling price for additional location
                            ltmFee: tier.LTM_Fee || 0,
                            marginDenominator: tier.MarginDenominator
                        });
                    }
                });
            });
        }
        
        console.log('[CaspioAdapterV2] Bundle transformation complete:', transformed);
        return transformed;
    }


    dispatchReady(data) {
        console.log('[CaspioAdapterV2] Dispatching "screenPrintMasterBundleReady" event with data:', data);
        document.dispatchEvent(new CustomEvent('screenPrintMasterBundleReady', {
            detail: data
        }));
        console.log('[CaspioAdapterV2] "screenPrintMasterBundleReady" event dispatched.');
    }

    dispatchError(error) {
        console.error('[CaspioAdapterV2] Dispatching "screenPrintMasterBundleError" event. Error:', error);
        document.dispatchEvent(new CustomEvent('screenPrintMasterBundleError', {
            detail: { error }
        }));
        console.error('[CaspioAdapterV2] "screenPrintMasterBundleError" event dispatched.');
    }

    // Public method to check if data is ready
    getIsReady() {
        return this.isReady;
    }

    // Public method to get master bundle
    getMasterBundle() {
        return this.masterBundle;
    }
}

// Initialize adapter
window.ScreenPrintCaspioAdapterV2 = new ScreenPrintCaspioAdapter();