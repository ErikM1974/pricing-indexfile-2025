// shared_components/js/dtg-adapter.js
console.log("[ADAPTER:DTG] DTG Adapter loaded. Master Bundle Version with BaseAdapter.");

(function() {
    "use strict";

    // DTG Adapter extends BaseAdapter
    class DTGAdapter extends BaseAdapter {
        constructor() {
            super('dtg', {
                appKey: 'a0e150002eb9491a50104c1d99d7',
                debug: true,
                errorMessageId: 'caspio-dtg-error-message',
                fallbackUIId: 'cart-fallback-ui'
            });
            
            // DTG-specific state
            this.currentSelectedPrintLocation = "";
            this.caspioLoaded = false;
        }

        // Override initialization to set up DTG-specific features
        async init() {
            this.debugLog('Initializing DTG adapter...');
            
            try {
                // Call parent initialization
                await super.init();
                
                // Set up location selector
                this.setupLocationSelector();
                
                // Store for compatibility
                window.dtgMasterPriceBundle = null;
                
                this.debugLog('DTG adapter initialization complete');
                
            } catch (error) {
                this.handleError('DTG adapter initialization failed', error);
            }
        }

        // Override data loading for DTG-specific Caspio integration
        async loadData() {
            const styleNumber = typeof NWCAUtils !== 'undefined' ? NWCAUtils.getUrlParameter('StyleNumber') : null;
            const colorName = (typeof NWCAUtils !== 'undefined' && NWCAUtils.getUrlParameter('COLOR')) ? 
                decodeURIComponent(NWCAUtils.getUrlParameter('COLOR').replace(/\+/g, ' ')) : null;
            
            this.debugLog('Loading DTG data for:', { styleNumber, colorName });
            
            if (!styleNumber) {
                this.handleError("Product style not specified in URL. Pricing cannot be loaded.");
                return;
            }

            // Load Caspio datapage only once
            if (!this.caspioLoaded) {
                this.debugLog('Loading Caspio datapage for the first time');
                this.caspioLoaded = true;
                this.loadCaspioDatapage(styleNumber, colorName);
            } else {
                this.debugLog('Caspio already loaded, skipping');
            }
        }

        // Override specific data processing for DTG
        async processSpecificData(masterBundle) {
            this.debugLog('Processing DTG-specific data');
            
            // Store master bundle globally for compatibility with dtg-pricing-v4.js
            window.dtgMasterPriceBundle = masterBundle;
            this.debugLog('Stored master bundle in window.dtgMasterPriceBundle');
            
            // Update location dropdown with data from Caspio
            this.updateLocationDropdownFromBundle(masterBundle);
            
            // Set initial location
            const parentDropdown = document.getElementById('dtg-location-select');
            let initialLocationCode = parentDropdown ? parentDropdown.value : null;

            if (!initialLocationCode && masterBundle.printLocationMeta && masterBundle.printLocationMeta.length > 0) {
                initialLocationCode = masterBundle.printLocationMeta[0].code;
                if (parentDropdown) parentDropdown.value = initialLocationCode;
            }
            
            // Display pricing for initial location after delay
            setTimeout(() => {
                if (initialLocationCode && masterBundle.allLocationPrices[initialLocationCode] !== undefined) {
                    this.displayPricingForSelectedLocation(initialLocationCode);
                } else if (masterBundle.printLocationMeta && masterBundle.printLocationMeta.length > 0) {
                    const firstValidLocation = masterBundle.printLocationMeta.find(loc => 
                        masterBundle.allLocationPrices[loc.code] !== undefined);
                    if (firstValidLocation) {
                        initialLocationCode = firstValidLocation.code;
                        if (parentDropdown) parentDropdown.value = initialLocationCode;
                        this.displayPricingForSelectedLocation(initialLocationCode);
                    } else {
                        this.handleError('Pricing data available, but not for the default/selected location. Please choose another.');
                    }
                } else {
                    this.handleError('Please select a print location to view pricing.');
                }
            }, 500);
        }
        // DTG-specific method: Update location dropdown
        updateLocationDropdownFromBundle(masterBundle) {
            const dropdown = document.getElementById('dtg-location-select');
            if (!dropdown || !masterBundle.printLocationMeta || !Array.isArray(masterBundle.printLocationMeta)) {
                this.debugWarn('Cannot update dropdown - missing dropdown element or location metadata');
                return;
            }
            
            this.debugLog('Updating location dropdown with', masterBundle.printLocationMeta.length, 'locations from Caspio');
            
            // Save current selection
            const currentValue = dropdown.value;
            
            // Clear existing options
            dropdown.innerHTML = '<option value="">-- Choose Print Location --</option>';
            
            // Add all locations from Caspio
            masterBundle.printLocationMeta.forEach(location => {
                const option = document.createElement('option');
                option.value = location.code || '';
                option.textContent = location.name || location.code || 'Unknown Location';
                dropdown.appendChild(option);
            });
            
            // Restore previous selection if it still exists
            if (currentValue && Array.from(dropdown.options).some(opt => opt.value === currentValue)) {
                dropdown.value = currentValue;
            }
            
            this.debugLog('Dropdown updated with locations:', 
                masterBundle.printLocationMeta.map(loc => `${loc.code}: ${loc.name}`).join(', '));
        }

        // DTG-specific method: Display pricing for selected location
        async displayPricingForSelectedLocation(locationCode) {
            this.debugLog(`Displaying pricing for location: ${locationCode}`);
            
            // Show loading state immediately with smooth transition
            this.showLoadingState();
            
            // Small delay to ensure loading state is visible
            await this.delay(100);
            
            if (!this.masterBundle || !this.masterBundle.allLocationPrices) {
                this.handleError('Pricing data is not loaded. Please refresh.');
                return;
            }

            const masterBundle = this.masterBundle;
            const locationPriceProfile = masterBundle.allLocationPrices[locationCode];

            if (locationPriceProfile === null || locationPriceProfile === undefined) {
                this.debugWarn(`No price profile data found for location '${locationCode}' in master bundle.`);
                const dtgPricingGrid = document.getElementById('custom-pricing-grid'); 
                if (dtgPricingGrid) {
                    const tbody = dtgPricingGrid.querySelector('tbody');
                    if (tbody) tbody.innerHTML = `<tr><td colspan="100%" style="text-align:center; padding:20px;">Pricing not available for selected location: ${locationCode}.</td></tr>`;
                }
                if (typeof window.clearCartIntegrationUI === 'function') { 
                    window.clearCartIntegrationUI();
                }
                return;
            }
            
            this.clearMessages();

            // Ensure tierData is properly structured with all expected tiers
            const ensuredTierData = masterBundle.tierData || {};
            
            // Check and ensure ALL standard DTG tiers are present
            const expectedTiers = {
                '24-47': { MinQuantity: 24, MaxQuantity: 47 },
                '48-71': { MinQuantity: 48, MaxQuantity: 71 },
                '72+': { MinQuantity: 72, MaxQuantity: 99999 }
            };
            
            // Add any missing tiers
            let tiersAdded = false;
            Object.keys(expectedTiers).forEach(tierKey => {
                if (!ensuredTierData[tierKey]) {
                    this.debugWarn(`Missing tier '${tierKey}', adding default values`);
                    ensuredTierData[tierKey] = expectedTiers[tierKey];
                    tiersAdded = true;
                }
            });
            
            if (tiersAdded) {
                this.debugLog('Added missing tiers to ensure complete tier structure');
            }
            
            // Use individual sizes for the pricing table (no grouping)
            const individualHeaders = masterBundle.uniqueSizes || ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
            const individualPrices = {};
            
            // Log the sizes being used
            this.debugLog('Using individual sizes for pricing table:', individualHeaders);
            
            // Get prices for each individual size
            individualHeaders.forEach(size => {
                individualPrices[size] = {};
                Object.keys(ensuredTierData).forEach(tierKey => {
                    if (locationPriceProfile[size] && locationPriceProfile[size][tierKey] !== undefined) {
                        individualPrices[size][tierKey] = parseFloat(locationPriceProfile[size][tierKey]);
                    } else {
                        individualPrices[size][tierKey] = 0;
                    }
                });
            });
            
            this.debugLog('Individual size pricing prepared:', {
                headers: individualHeaders,
                samplePrices: individualPrices['S'] || {}
            });
            
            const singleLocationDataPayload = {
                styleNumber: masterBundle.styleNumber,
                color: masterBundle.color,
                embellishmentType: "dtg",
                headers: individualHeaders,  // Use individual sizes
                prices: individualPrices,    // Use individual size prices
                tierData: ensuredTierData,
                tiers: ensuredTierData, // Add both for compatibility
                uniqueSizes: masterBundle.uniqueSizes || [], // Keep original for cart functionality
                selectedLocationValue: locationCode,
                productTitle: masterBundle.productTitle || masterBundle.styleNumber,
                capturedAt: new Date().toISOString(),
                hasError: false, // Assuming if we have a profile, it's not an error state for this location
                errorMessage: ""
            };
            
            this.debugLog('Preparing to dispatch pricingDataLoaded with:', {
                headers: singleLocationDataPayload.headers,
                tierKeys: Object.keys(singleLocationDataPayload.tierData),
                uniqueSizes: singleLocationDataPayload.uniqueSizes,
                pricesForFirstSize: singleLocationDataPayload.headers[0] ? singleLocationDataPayload.prices[singleLocationDataPayload.headers[0]] : 'No sizes',
                embellishmentType: singleLocationDataPayload.embellishmentType
            });
            
            window.nwcaPricingData = singleLocationDataPayload;

            // Dispatch on window to match dp5-helper's listener target
            window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: singleLocationDataPayload }));
            this.debugLog('Dispatched pricingDataLoaded event ON WINDOW for selected location:', locationCode);

            // The universal pricing grid handles its own display, so we don't need to manipulate the old grid
            // Just make sure the data is dispatched and let the universal components handle display
            this.debugLog('Pricing data dispatched, universal components will handle display');
            
            // Trigger price grouping after displaying pricing (only once per location change)
            if (!window.dtgPriceGroupingScheduled) {
                window.dtgPriceGroupingScheduled = true;
                setTimeout(() => {
                    if (window.DTGPriceGroupingV4 && typeof window.DTGPriceGroupingV4.applyPriceGrouping === 'function') {
                        this.debugLog('Triggering price grouping after location data display');
                        window.DTGPriceGroupingV4.applyPriceGrouping();
                    }
                    window.dtgPriceGroupingScheduled = false;
                }, 2000); // Wait 2 seconds for table to fully render
            }

            if (window.PricingMatrixCapture && typeof window.PricingMatrixCapture.stop === 'function') {
                window.PricingMatrixCapture.stop();
            }

            if (typeof window.initCartIntegrationWithData === 'function') {
                try {
                    this.debugLog('Calling initCartIntegrationWithData for location:', locationCode, singleLocationDataPayload);
                    await window.initCartIntegrationWithData(singleLocationDataPayload);
                    this.debugLog('Cart integration updated for location:', locationCode);
                } catch (cartError) {
                    this.debugError('Error updating cart integration for location:', locationCode, cartError);
                    this.displayFallbackUI('There was an issue preparing the add-to-cart functionality for the selected location.');
                }
            } else {
                this.debugWarn('initCartIntegrationWithData function not found.');
                this.displayFallbackUI('The add-to-cart functionality is not fully available.');
            }
        }
        
        // Caspio data page loading
        loadCaspioDatapage(styleNumber, colorName) {
            this.debugLog('loadCaspioDatapage called with:', { styleNumber, colorName });
            
            const container = document.getElementById('pricing-calculator');
            if (!container) {
                this.debugError('Pricing calculator container not found');
                return;
            }
            
            this.debugLog('Found pricing-calculator container');
            
            // Create the Caspio script dynamically with parameters
            const script = document.createElement('script');
            script.type = 'text/javascript';
            
            // Build URL with parameters
            const params = new URLSearchParams();
            if (styleNumber) params.append('StyleNumber', styleNumber);
            if (colorName) params.append('COLOR', colorName);
            
            script.src = `https://c3eku948.caspio.com/dp/a0e150002177c037d053438abf13/emb?${params.toString()}`;
            
            this.debugLog('Loading Caspio datapage with URL:', script.src);
            
            // Add load and error handlers
            script.onload = () => this.debugLog('Caspio script loaded successfully');
            script.onerror = (e) => this.debugError('Failed to load Caspio script:', e);
            
            container.appendChild(script);
            this.debugLog('Script element appended to container');
        }

        // Set up location selector dropdown functionality
        setupLocationSelector() {
            let retryCount = 0;
            const maxRetries = 20;
            
            const tryFindDropdown = () => {
                const parentLocationDropdown = document.getElementById('dtg-location-select');
                
                if (!parentLocationDropdown && retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(tryFindDropdown, 500);
                    return;
                }
                
                if (parentLocationDropdown) {
                    // Style the dropdown to make it more prominent
                    parentLocationDropdown.style.border = '2px solid #2e5827';
                    parentLocationDropdown.style.fontWeight = 'bold';
                    parentLocationDropdown.style.backgroundColor = '#f8f9fa';
                    parentLocationDropdown.style.padding = '10px';
                    parentLocationDropdown.style.fontSize = '1.1em';
                    
                    window.currentSelectedPrintLocation = parentLocationDropdown.value;
                    
                    // Add visual indicator for current selection
                    updateLocationIndicator(parentLocationDropdown.value);

                    parentLocationDropdown.addEventListener('change', (event) => {
                        const selectedValue = event.target.value;
                        this.debugLog('Parent location dropdown changed to:', selectedValue);
                        window.currentSelectedPrintLocation = selectedValue;
                        
                        // Update visual indicator
                        updateLocationIndicator(selectedValue);
                        
                        // Show loading state immediately
                        this.showLoadingState();

                        if (this.masterBundle) {
                            // Add a small delay to show loading state
                            setTimeout(() => {
                                this.displayPricingForSelectedLocation(selectedValue);
                            }, 300);
                        } else {
                            this.debugWarn('Location changed, but master bundle not yet loaded.');
                            const dtgPricingGrid = document.getElementById('custom-pricing-grid');
                            if (dtgPricingGrid) {
                                const tbody = dtgPricingGrid.querySelector('tbody');
                                if (tbody && (!tbody.textContent || tbody.textContent.trim() === "")) {
                                   tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding:20px;">Loading pricing data...</td></tr>';
                                }
                            }
                        }
                    });
                    this.debugLog('Event listener added to dtg-location-select.');
                } else {
                    this.debugWarn('dtg-location-select dropdown not found after ' + retryCount + ' attempts.');
                }
            };
            
            // Start trying to find the dropdown
            tryFindDropdown();
        }
    }

    // Global variables for compatibility with existing code
    let dtgProcessingMasterBundle = false;
    const EXPECTED_CASPIO_ORIGIN_1 = 'https://c3eku948.caspio.com';
    const EXPECTED_CASPIO_ORIGIN_2 = 'https://nwcustom.caspio.com';
    const EXPECTED_CASPIO_ORIGIN_3 = 'https://www.teamnwca.com';
    const DTG_APP_KEY = 'a0e150002eb9491a50104c1d99d7';

    // Initialize DTG adapter using the new class-based approach
    async function initDTGPricing() {
        console.log("[ADAPTER:DTG] Initializing DTG pricing adapter (Master Bundle)...");
        
        // Create and initialize the DTG adapter instance
        if (!window.dtgAdapter) {
            window.dtgAdapter = new DTGAdapter();
        }
        
        await window.dtgAdapter.init();
        
        // Store reference for compatibility
        window.dtgMasterPriceBundle = null;
        window.dtgCaspioLoaded = false;
    }

    // Legacy compatibility wrapper
    window.DTGAdapter = {
        APP_KEY: DTG_APP_KEY,
        init: initDTGPricing,
        processMasterBundle: (bundle) => {
            if (window.dtgAdapter) {
                return window.dtgAdapter.processMasterBundle(bundle);
            }
        },
        displayPricingForSelectedLocation: (locationCode) => {
            if (window.dtgAdapter) {
                return window.dtgAdapter.displayPricingForSelectedLocation(locationCode);
            }
        }
    };
    // Global variables for compatibility
    let dtgCaspioDataProcessed = false;
    let dtgCaspioMessageTimeoutId = null;
    
    // Legacy function wrappers for compatibility
    function setupParentLocationSelector() {
        if (window.dtgAdapter && typeof window.dtgAdapter.setupLocationSelector === 'function') {
            window.dtgAdapter.setupLocationSelector();
        }
    }
    
    function updateLocationIndicator(locationValue) {
        // Update the pricing header to show selected location
        const pricingHeader = document.querySelector('.pricing-header .section-title');
        if (pricingHeader && locationValue) {
            const locationText = document.querySelector(`#dtg-location-select option[value="${locationValue}"]`)?.textContent || locationValue;
            pricingHeader.innerHTML = `Detailed Pricing per Quantity Tier <span style="color: #2e5827; font-size: 0.9em;">(${locationText})</span>`;
        }
        
        // Update dropdown visual state
        const dropdown = document.getElementById('dtg-location-select');
        if (dropdown) {
            dropdown.style.borderColor = '#2e5827';
            dropdown.style.boxShadow = '0 0 5px rgba(46, 88, 39, 0.3)';
        }
    }
    
    function displayPricingForSelectedLocation(locationCode) {
        if (window.dtgAdapter) {
            return window.dtgAdapter.displayPricingForSelectedLocation(locationCode);
        }
    }
    
    function processMasterBundle(bundle) {
        if (window.dtgAdapter) {
            return window.dtgAdapter.processMasterBundle(bundle);
        }
    }
    
    function clearMessages() {
        if (window.dtgAdapter) {
            return window.dtgAdapter.clearMessages();
        }
    }
    
    function displayError(message) {
        if (window.dtgAdapter) {
            return window.dtgAdapter.displayError(message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDTGPricing);
    } else {
        initDTGPricing(); 
    }

})();