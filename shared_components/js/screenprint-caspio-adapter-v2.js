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

        // Only accept the new format with separate garmentSellingPrices and printCosts
        if (data.garmentSellingPrices && data.printCosts && data.tierData) {
            console.log('[CaspioAdapterV2] Valid bundle format detected. Transforming data...');
            data = this.transformBundleData(data);
        } else {
            console.error('[CaspioAdapterV2] CRITICAL: Invalid bundle format. Expected format with garmentSellingPrices and printCosts.');
            console.error('[CaspioAdapterV2] Received keys:', Object.keys(data));
            this.dispatchError('Invalid bundle format - please ensure Caspio is sending the new format with garmentSellingPrices and printCosts');
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
            
            // Keep new structure data
            garmentSellingPrices: rawData.garmentSellingPrices,
            printCosts: rawData.printCosts,
            
            // Transform pricing structure
            primaryLocationPricing: {},
            additionalLocationPricing: {}
        };
        
        // Get setup fee and flash charge from rules
        const setupFee = parseFloat(rawData.rulesData.SetupFeePerColor) || 30;
        const flashCharge = parseFloat(rawData.rulesData.FlashCharge) || 0.35;
        
        // Process primary location pricing
        if (rawData.printCosts.PrimaryLocation) {
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
        
        // Add garment-only pricing (0 colors)
        transformed.primaryLocationPricing["0"] = {
            tiers: [],
            setupFee: 0,
            flashCharge: 0
        };
        
        rawData.tierData.forEach(tier => {
            const tierLabel = tier.TierLabel;
            const garmentPrices = rawData.garmentSellingPrices[tierLabel];
            
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
        
        // Process additional location pricing
        if (rawData.printCosts.AdditionalLocation) {
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