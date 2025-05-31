// shared_components/js/screenprint-adapter.js

const screenPrintAdapter = (() => {
    let masterBundle = null;
    let masterBundleReceived = false;
    const CASPIO_TIMEOUT = 10000; // Increased timeout slightly to 10s
    let debounceTimeout;
    const priceCache = new Map();

    const elements = {
        colorSelect: null,
        additionalLogoCheckbox: null,
        pricingFallback: null,
    };

    function initializeDOMElements() {
        elements.colorSelect = document.getElementById('color-select');
        elements.additionalLogoCheckbox = document.getElementById('additional-logo-checkbox');
        elements.pricingFallback = document.getElementById('pricing-fallback');

        if (!elements.colorSelect) console.error("ScreenPrintAdapter: Color select dropdown not found.");
        if (!elements.additionalLogoCheckbox) console.error("ScreenPrintAdapter: Additional logo checkbox not found.");
        if (!elements.pricingFallback) console.error("ScreenPrintAdapter: Pricing fallback div not found.");
    }

    function storeMasterBundle(data) {
        masterBundle = data;
        masterBundleReceived = true;
        console.log('ScreenPrintAdapter: Screen print master bundle stored:', masterBundle);
        priceCache.clear();
        // Dispatch an event indicating the adapter is ready with the master bundle
        document.dispatchEvent(new CustomEvent('screenPrintAdapterReady', { detail: { success: true } }));
    }

    function getSelectedConfiguration() {
        if (!elements.colorSelect || !elements.additionalLogoCheckbox) {
            // console.error("ScreenPrintAdapter: UI elements for configuration not initialized yet.");
            return null;
        }
        const selectedColorCount = elements.colorSelect.value;
        const isAdditionalLocation = elements.additionalLogoCheckbox.checked;
        return { selectedColorCount, isAdditionalLocation };
    }

    function extractAndDispatchPricingData() {
        if (!masterBundleReceived || !masterBundle) {
            console.warn('ScreenPrintAdapter: Master bundle not available or not received yet. Cannot dispatch pricing data.');
            // Do not show fallback here, timeout will handle it if Caspio fails completely
            // Dispatch an empty/error state for UI to clear or show "select options"
            document.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: { embellishmentType: 'ScreenPrint', tiers: [], fees: {}, uniqueSizes: [], error: 'Master bundle not ready.' } }));
            return;
        }

        const config = getSelectedConfiguration();
        if (!config || !config.selectedColorCount) {
            console.log('ScreenPrintAdapter: No color count selected. Not dispatching pricing data.');
            document.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: { embellishmentType: 'ScreenPrint', tiers: [], fees: {}, uniqueSizes: masterBundle.uniqueSizes || [], message: 'Please select number of colors.' } }));
            return;
        }
        
        // Log the master bundle structure to help debug
        console.log('ScreenPrintAdapter: Master bundle structure:', Object.keys(masterBundle));
        
        // Try different possible location keys based on Caspio data structure
        const possibleLocationKeys = ['primaryLocationPricing', 'primary_location_pricing', 'pricing', 'screenPrintPricing', 'screen_print_pricing'];
        let locationKey = null;
        let pricingDataForColorCount = null;
        
        // Try to find the correct key in the master bundle
        for (const key of possibleLocationKeys) {
            if (masterBundle[key]) {
                console.log(`ScreenPrintAdapter: Found pricing key: ${key}`);
                locationKey = key;
                
                // Try to get pricing data for the selected color count
                if (masterBundle[key][config.selectedColorCount]) {
                    pricingDataForColorCount = masterBundle[key][config.selectedColorCount];
                    break;
                }
            }
        }
        
        // If we still don't have pricing data, try to look at the structure of the master bundle
        if (!pricingDataForColorCount) {
            console.warn(`ScreenPrintAdapter: Could not find pricing data for ${config.selectedColorCount} colors in standard locations. Examining bundle structure...`);
            
            // If the master bundle itself has tiers, it might be the pricing data directly
            if (masterBundle.tiers) {
                console.log('ScreenPrintAdapter: Master bundle appears to contain pricing data directly');
                pricingDataForColorCount = masterBundle;
            }
        }

        if (pricingDataForColorCount) {
            console.log('ScreenPrintAdapter: Found pricing data for color count:', config.selectedColorCount);
            
            // Create a formatted data object with fallbacks for missing properties
            const formattedData = {
                styleNumber: masterBundle.sN || masterBundle.styleNumber || '',
                color: masterBundle.cN || masterBundle.color || '',
                productTitle: masterBundle.pT || masterBundle.productTitle || '',
                embellishmentType: 'screen-print', // Changed to lowercase
                uniqueSizes: masterBundle.uniqueSizes || [],
                tiers: pricingDataForColorCount.tiers ? pricingDataForColorCount.tiers.map(tier => ({
                    ...tier,
                    price: tier.prices || tier.price || {}
                })) : [],
                fees: {
                    setup: pricingDataForColorCount.setupFee || pricingDataForColorCount.setup_fee || 0,
                    flash: pricingDataForColorCount.flashChargeTotal || pricingDataForColorCount.flash_charge || 0
                },
                additionalLocationCostsForSelectedColor: masterBundle.additionalLocationPricing ? // This is the specific one for current primary color selection
                    masterBundle.additionalLocationPricing[config.selectedColorCount] :
                    (masterBundle.additional_location_pricing ? masterBundle.additional_location_pricing[config.selectedColorCount] : null),
                fullAdditionalLocationPricing: masterBundle.additionalLocationPricing || masterBundle.additional_location_pricing || null, // This is the full object for 1-6 colors
                rules: masterBundle.pricingRules || masterBundle.pricing_rules || {}
            };

            // Hide the loading message and show the pricing grid
            const loadingElement = document.getElementById('pricing-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            const pricingGrid = document.getElementById('custom-pricing-grid');
            if (pricingGrid) {
                pricingGrid.style.display = 'table';
            }

            document.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: formattedData }));
            console.log('ScreenPrintAdapter: Dispatched pricingDataLoaded event with:', formattedData);
            if (elements.pricingFallback) elements.pricingFallback.style.display = 'none';
        } else {
            console.error(`ScreenPrintAdapter: Pricing data not found for ${config.selectedColorCount} colors in master bundle.`);
            if (elements.pricingFallback) elements.pricingFallback.style.display = 'block';
            document.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: { embellishmentType: 'ScreenPrint', tiers: [], fees: {}, uniqueSizes: masterBundle.uniqueSizes || [], error: `Pricing not found for ${config.selectedColorCount} colors.` } }));
        }
    }

    function handleUiChange() {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            console.log("ScreenPrintAdapter: UI change detected, extracting pricing data...");
            
            // Check if we have the master bundle
            if (!masterBundle) {
                console.warn("ScreenPrintAdapter: Master bundle not available yet. Waiting for data...");
                
                // Show a message to the user
                const pricingGrid = document.getElementById('custom-pricing-grid');
                if (pricingGrid) {
                    const tbody = pricingGrid.querySelector('tbody');
                    if (tbody) {
                        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">Loading pricing data, please wait...</td></tr>';
                    }
                }
                
                // Try again in a moment if we're still waiting for the bundle
                if (!masterBundleReceived) {
                    setTimeout(handleUiChange, 1000);
                }
                return;
            }
            
            extractAndDispatchPricingData();
        }, 150);
    }

    function getCachedPrice(colorCount, quantities, isAdditionalLocationChecked) {
        if (!masterBundle) {
            console.error("ScreenPrintAdapter (getCachedPrice): Master bundle not available.");
            return null;
        }

        const cacheKeyObject = {
            cc: colorCount,
            qty: quantities, 
            addLoc: isAdditionalLocationChecked
        };
        const cacheKey = JSON.stringify(cacheKeyObject);

        if (priceCache.has(cacheKey)) {
            console.log('ScreenPrintAdapter: Price cache hit for key:', cacheKey);
            return priceCache.get(cacheKey);
        }
        
        if (typeof NWCAPricingCalculator !== 'undefined' && typeof NWCAPricingCalculator.calculatePricing === 'function') {
            const pricingInput = {
                masterBundle: masterBundle,
                selectedColorCount: colorCount,
                quantities: quantities, 
                isAdditionalLocation: isAdditionalLocationChecked,
                embellishmentType: 'ScreenPrint'
            };
            const calculatedPriceDetails = NWCAPricingCalculator.calculatePricing(pricingInput);
            priceCache.set(cacheKey, calculatedPriceDetails);
            console.log('ScreenPrintAdapter: Price cached for key:', cacheKey, 'details:', calculatedPriceDetails);
            return calculatedPriceDetails;
        } else {
            console.error("ScreenPrintAdapter: NWCAPricingCalculator.calculatePricing function not found.");
            return null; 
        }
    }

    function setupEventListeners() {
        if (elements.colorSelect) {
            elements.colorSelect.addEventListener('change', function() {
                console.log("ScreenPrintAdapter: Color select changed to:", elements.colorSelect.value);
                handleUiChange();
            });
        } else {
            console.warn("ScreenPrintAdapter: Color select not found for event listener during setup.");
        }
        
        if (elements.additionalLogoCheckbox) {
             elements.additionalLogoCheckbox.addEventListener('change', function() {
                console.log("ScreenPrintAdapter: Additional logo checkbox changed to:", elements.additionalLogoCheckbox.checked);
                handleUiChange();
             });
        } else {
            console.warn("ScreenPrintAdapter: Additional logo checkbox not found for event listener during setup.");
        }

        window.addEventListener('message', (event) => {
            // Log all messages for debugging
            console.log('ScreenPrintAdapter DEBUG: Message event received. Origin:', event.origin, 'Data:', event.data);

            // Accept messages from any origin during development
            // In production, you would restrict to specific origins
            const isCorrectCaspioOrigin = (event.origin === 'https://c3eku948.caspio.com');
            const isLocalhost = event.origin.includes('localhost');
            // Allow all origins for now during development
            const isAllowedOrigin = true;

            if (event.data && event.data.type === 'caspioScreenPrintMasterBundleReady') {
                console.log('ScreenPrintAdapter: Processing caspioScreenPrintMasterBundleReady with data:', JSON.stringify(event.data.data).substring(0, 200) + '...');
                
                if (!event.data.data) {
                    console.error('ScreenPrintAdapter: Received empty data in caspioScreenPrintMasterBundleReady event');
                    if (elements.pricingFallback) elements.pricingFallback.style.display = 'block';
                    return;
                }
                
                storeMasterBundle(event.data.data);
                
                // Force UI update after a short delay to ensure DOM is ready
                setTimeout(() => {
                    console.log('ScreenPrintAdapter: Master bundle received, updating UI...');
                    
                    // If color select has a value, use it, otherwise trigger change to select first option
                    if (elements.colorSelect && elements.colorSelect.value) {
                        handleUiChange();
                    } else if (elements.colorSelect) {
                        // Select the first non-empty option if none selected
                        for (let i = 0; i < elements.colorSelect.options.length; i++) {
                            if (elements.colorSelect.options[i].value) {
                                elements.colorSelect.selectedIndex = i;
                                elements.colorSelect.dispatchEvent(new Event('change'));
                                break;
                            }
                        }
                    } else {
                        handleUiChange();
                    }
                }, 300);
            } else if (event.data && event.data.type === 'caspioPricingError') {
                if (!isAllowedOriginForDebug) {
                    console.warn(`ScreenPrintAdapter DEBUG: Received 'caspioPricingError' from UNEXPECTED origin: ${event.origin}. Processing anyway for debug.`);
                }
                console.error('ScreenPrintAdapter: Received caspioPricingError from Caspio:', event.data.error);
                if (elements.pricingFallback) elements.pricingFallback.style.display = 'block';
                masterBundleReceived = true;
            } else {
                // For other messages, if you had any, you might still want an origin check
                // For now, we are primarily interested in the two types above.
                // console.log('ScreenPrintAdapter DEBUG: Received other message type or no data property:', event.data);
            }
            // --- END TEMPORARY DEBUGGING ---
        });
    }

    function init() {
        console.log("ScreenPrintAdapter: Initializing...");
        initializeDOMElements(); // Call this first
        setupEventListeners();

        setTimeout(() => {
            if (!masterBundleReceived && elements.pricingFallback) {
                console.error('ScreenPrintAdapter: Screen print master bundle not received within timeout.');
                elements.pricingFallback.style.display = 'block';
                document.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: 'Failed to load screen print pricing data (timeout).' }}));
            }
        }, CASPIO_TIMEOUT);
    }

    return {
        init,
        handleUiChange, 
        getCachedPrice,
        getSelectedConfiguration,
        isReady: () => masterBundleReceived && !!masterBundle // Helper to check if bundle is loaded
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', screenPrintAdapter.init);
} else {
    screenPrintAdapter.init();
}