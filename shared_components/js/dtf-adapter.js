/**
 * DTF Caspio Adapter V2
 * Handles communication between Caspio forms and DTF pricing calculator
 */
(function() {
    'use strict';

    class DTFCaspioAdapter {
        constructor() {
            this.config = {
                debug: true,
                defaultGarmentMarkup: 1.4,
                defaultQuantity: 24
            };
            this.currentData = {
                garmentCost: 0,
                quantity: this.config.defaultQuantity,
                freight: 0,
                ltmFee: 0,
                productInfo: null
            };
            this.initialDataDispatched = false;  // Track if we've dispatched initial data
            this.dispatchDebounceTimer = null;   // Debounce timer for events
            this.init();
        }

        init() {
            this.log('DTF Adapter V2: Initializing...');
            this.setupEventListeners();
            this.checkForInitialData();
        }

        setupEventListeners() {
            // Listen for Caspio form submissions
            document.addEventListener('submit', (e) => {
                if (this.isCaspioForm(e.target)) {
                    this.handleCaspioSubmit(e);
                }
            });

            // Listen for Caspio DataPage ready events
            document.addEventListener('DataPageReady', () => {
                this.log('DTF Adapter: Caspio DataPage Ready');
                this.extractCaspioData();
            });

            // Listen for custom pricing data events
            window.addEventListener('updateDTFPricing', (e) => {
                this.log('DTF Adapter: Received custom pricing update', e.detail);
                this.updatePricingData(e.detail);
            });

            // Listen for postMessage from parent window (iframe scenarios)
            window.addEventListener('message', (e) => {
                if (e.data && e.data.type === 'dtfPricingData') {
                    this.log('DTF Adapter: Received postMessage data', e.data);
                    this.updatePricingData(e.data.data);
                }
            });
        }

        async fetchBaseGarmentCost(styleNumber) {
            try {
                // First try the base-item-costs endpoint
                const apiUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/base-item-costs?styleNumber=${encodeURIComponent(styleNumber)}`;
                this.log('DTF Adapter: Fetching base garment costs from:', apiUrl);
                
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    console.warn(`DTF Adapter: base-item-costs API returned ${response.status} for style ${styleNumber}`);
                    // Try alternative endpoint
                    return await this.fetchAlternativeGarmentCost(styleNumber);
                }
                
                const data = await response.json();
                this.log('DTF Adapter: Received base costs data:', data);
                
                if (data && data.baseCosts && Object.keys(data.baseCosts).length > 0) {
                    // Find the lowest price
                    const prices = Object.values(data.baseCosts);
                    const lowestPrice = Math.min(...prices.filter(p => p > 0));
                    
                    if (lowestPrice && lowestPrice < Infinity) {
                        this.log('DTF Adapter: Found lowest base cost:', lowestPrice);
                        return lowestPrice;
                    }
                }
                
                // If no data in base costs, try alternative endpoint
                console.warn(`DTF Adapter: No base costs found for ${styleNumber}, trying alternative endpoint`);
                return await this.fetchAlternativeGarmentCost(styleNumber);
                
            } catch (error) {
                console.error('DTF Adapter: Error fetching base garment costs:', error);
                
                // Try alternative endpoint as last resort
                return await this.fetchAlternativeGarmentCost(styleNumber);
            }
        }
        
        async fetchAlternativeGarmentCost(styleNumber) {
            try {
                // Try size-pricing endpoint as alternative
                const altUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/size-pricing?styleNumber=${encodeURIComponent(styleNumber)}`;
                this.log('DTF Adapter: Trying alternative endpoint:', altUrl);
                
                const response = await fetch(altUrl);
                if (!response.ok) {
                    throw new Error(`Alternative API Error: ${response.status}`);
                }
                
                const data = await response.json();
                this.log('DTF Adapter: Alternative endpoint data:', data);
                
                if (data && data.sizePrices) {
                    // Find the lowest price across all sizes
                    const allPrices = Object.values(data.sizePrices).filter(p => p > 0);
                    if (allPrices.length > 0) {
                        const lowestPrice = Math.min(...allPrices);
                        this.log('DTF Adapter: Found price from alternative endpoint:', lowestPrice);
                        return lowestPrice;
                    }
                }
                
                // If still no data, check for max-prices endpoint
                const maxPriceUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/max-prices-by-style?styleNumber=${encodeURIComponent(styleNumber)}`;
                this.log('DTF Adapter: Trying max-prices endpoint:', maxPriceUrl);
                
                const maxResponse = await fetch(maxPriceUrl);
                if (maxResponse.ok) {
                    const maxData = await maxResponse.json();
                    if (maxData && maxData.maxPrices) {
                        const prices = Object.values(maxData.maxPrices).filter(p => p > 0);
                        if (prices.length > 0) {
                            const lowestPrice = Math.min(...prices);
                            this.log('DTF Adapter: Found price from max-prices endpoint:', lowestPrice);
                            return lowestPrice;
                        }
                    }
                }
                
                console.error(`DTF Adapter: No pricing data found for style ${styleNumber} in any endpoint`);
                
                // Dispatch API failure event
                window.dispatchEvent(new CustomEvent('dtfApiError', {
                    detail: {
                        error: `No pricing data available for style ${styleNumber}`,
                        styleNumber: styleNumber,
                        timestamp: new Date().toISOString()
                    },
                    bubbles: true
                }));
                
                return null;
                
            } catch (error) {
                console.error('DTF Adapter: Alternative endpoint error:', error);
                
                // Dispatch API failure event
                window.dispatchEvent(new CustomEvent('dtfApiError', {
                    detail: {
                        error: error.message,
                        styleNumber: styleNumber,
                        timestamp: new Date().toISOString()
                    },
                    bubbles: true
                }));
                
                return null;
            }
        }

        async checkForInitialData() {
            // Check URL parameters
            const urlParams = new URLSearchParams(window.location.search);

            // MANUAL MODE DETECTION: If manualCost parameter exists, skip adapter initialization
            const manualCost = urlParams.get('manualCost');
            if (manualCost) {
                this.log('DTF Adapter: Manual pricing mode detected, skipping adapter initialization');

                // Clear any cached data to prevent interference
                sessionStorage.removeItem('dtfPricingData');

                // Mark as initialized but don't dispatch any data
                this.initialDataDispatched = true;
                return;
            }

            const styleNumber = urlParams.get('StyleNumber') || urlParams.get('styleNumber') || urlParams.get('sku');
            const garmentCost = urlParams.get('garmentCost') || urlParams.get('cost');
            const quantity = urlParams.get('quantity') || urlParams.get('qty');
            const productName = urlParams.get('productName') || urlParams.get('name');
            const productSku = urlParams.get('sku') || styleNumber;
            const productImage = urlParams.get('image');

            let hasData = false;
            const data = {};

            // If we have a style number but no garment cost, fetch it from API
            if (styleNumber && !garmentCost) {
                const apiCost = await this.fetchBaseGarmentCost(styleNumber);
                if (apiCost !== null) {
                    data.garmentCost = apiCost;
                    hasData = true;
                    this.log('DTF Adapter: Using API garment cost:', apiCost);
                }
            } else if (garmentCost) {
                data.garmentCost = parseFloat(garmentCost);
                hasData = true;
            }

            if (quantity) {
                data.quantity = parseInt(quantity);
                hasData = true;
            }

            if (productName || productSku || productImage) {
                data.productInfo = {
                    name: productName,
                    sku: productSku,
                    image: productImage
                };
                hasData = true;
            }

            // Check for data in sessionStorage and merge with URL data
            const storedData = sessionStorage.getItem('dtfPricingData');
            if (storedData) {
                try {
                    const parsedData = JSON.parse(storedData);
                    this.log('DTF Adapter: Found stored data', parsedData);
                    
                    // Merge stored data with URL data (URL data takes precedence)
                    Object.assign(data, parsedData, data);
                    hasData = true;
                } catch (e) {
                    this.log('DTF Adapter: Error parsing stored data', e);
                }
            }
            
            // Dispatch consolidated initial data only once
            if (hasData && !this.initialDataDispatched) {
                this.log('DTF Adapter: Dispatching consolidated initial data', data);
                this.initialDataDispatched = true;
                this.updatePricingData(data, true); // true = skip debounce for initial data
            }
        }

        isCaspioForm(form) {
            // Check if form is a Caspio form
            return form.id && (
                form.id.includes('caspioform') ||
                form.id.includes('cbParamVirtual') ||
                form.getAttribute('data-caspio-form') === 'true'
            );
        }

        handleCaspioSubmit(event) {
            this.log('DTF Adapter: Handling Caspio form submit');
            // Extract data before form submits
            this.extractCaspioData();
        }

        extractCaspioData() {
            // Look for common Caspio field patterns
            const fields = {
                garmentCost: this.findCaspioField(['cost', 'price', 'garmentCost', 'unitCost']),
                quantity: this.findCaspioField(['quantity', 'qty', 'amount']),
                productName: this.findCaspioField(['productName', 'name', 'itemName']),
                productSku: this.findCaspioField(['sku', 'productSku', 'itemSku']),
                freight: this.findCaspioField(['freight', 'shipping']),
                ltmFee: this.findCaspioField(['ltmFee', 'ltm', 'fee'])
            };

            const data = {};
            let hasData = false;

            if (fields.garmentCost) {
                const value = this.getFieldValue(fields.garmentCost);
                if (value) {
                    data.garmentCost = parseFloat(value.replace(/[$,]/g, ''));
                    hasData = true;
                }
            }

            if (fields.quantity) {
                const value = this.getFieldValue(fields.quantity);
                if (value) {
                    data.quantity = parseInt(value);
                    hasData = true;
                }
            }

            if (fields.freight) {
                const value = this.getFieldValue(fields.freight);
                if (value) {
                    data.freight = parseFloat(value.replace(/[$,]/g, ''));
                    hasData = true;
                }
            }

            if (fields.ltmFee) {
                const value = this.getFieldValue(fields.ltmFee);
                if (value) {
                    data.ltmFee = parseFloat(value.replace(/[$,]/g, ''));
                    hasData = true;
                }
            }

            if (fields.productName || fields.productSku) {
                data.productInfo = {
                    name: fields.productName ? this.getFieldValue(fields.productName) : null,
                    sku: fields.productSku ? this.getFieldValue(fields.productSku) : null
                };
                hasData = true;
            }

            if (hasData) {
                this.log('DTF Adapter: Extracted Caspio data', data);
                this.updatePricingData(data);
            }
        }

        findCaspioField(fieldNames) {
            for (const name of fieldNames) {
                // Try different Caspio field naming patterns
                const patterns = [
                    `[name*="${name}"]`,
                    `[id*="${name}"]`,
                    `[name*="cbParamVirtual${name}"]`,
                    `[id*="cbParamVirtual${name}"]`,
                    `[data-field="${name}"]`
                ];

                for (const pattern of patterns) {
                    const field = document.querySelector(pattern);
                    if (field) {
                        this.log(`DTF Adapter: Found field for ${name}`, field);
                        return field;
                    }
                }
            }
            return null;
        }

        getFieldValue(field) {
            if (!field) return null;

            // Handle different input types
            if (field.tagName === 'SELECT') {
                return field.options[field.selectedIndex]?.value || null;
            } else if (field.type === 'checkbox') {
                return field.checked ? field.value : null;
            } else if (field.type === 'radio') {
                const checked = document.querySelector(`[name="${field.name}"]:checked`);
                return checked ? checked.value : null;
            } else {
                return field.value || null;
            }
        }

        updatePricingData(data, skipDebounce = false) {
            // Track if this is a critical update that needs immediate processing
            const isCriticalUpdate = data.garmentCost !== undefined ||
                                    (data.productInfo && data.productInfo.sku);

            // Update current data
            if (data.garmentCost !== undefined) {
                this.currentData.garmentCost = data.garmentCost;
            }
            if (data.quantity !== undefined) {
                this.currentData.quantity = data.quantity;
            }
            if (data.freight !== undefined) {
                this.currentData.freight = data.freight;
            }
            if (data.ltmFee !== undefined) {
                this.currentData.ltmFee = data.ltmFee;
            }
            if (data.productInfo) {
                this.currentData.productInfo = {
                    ...this.currentData.productInfo,
                    ...data.productInfo
                };
            }

            // Store in sessionStorage for persistence
            sessionStorage.setItem('dtfPricingData', JSON.stringify(this.currentData));

            // Dispatch event immediately for critical updates (garment cost or style changes)
            // Use debouncing only for non-critical updates
            if (skipDebounce || isCriticalUpdate) {
                this.dispatchDataEvent();
            } else {
                this.dispatchDataEventDebounced();
            }
        }

        dispatchDataEventDebounced() {
            // Clear existing timer
            if (this.dispatchDebounceTimer) {
                clearTimeout(this.dispatchDebounceTimer);
            }

            // Set new timer - reduced to 25ms for faster response
            this.dispatchDebounceTimer = setTimeout(() => {
                this.dispatchDataEvent();
            }, 25); // Reduced from 100ms to 25ms for better responsiveness
        }

        dispatchDataEvent() {
            const eventData = {
                type: 'dtf',
                ...this.currentData
            };

            // Dispatch specific DTF adapter event
            window.dispatchEvent(new CustomEvent('dtfAdapterDataReceived', {
                detail: eventData,
                bubbles: true
            }));

            // Also dispatch generic event for backward compatibility
            window.dispatchEvent(new CustomEvent('caspioDataReceived', {
                detail: eventData,
                bubbles: true
            }));

            this.log('DTF Adapter: Dispatched data event', eventData);
            
            // If integration isn't ready yet, retry after a delay
            if (!window.dtfIntegration || !window.dtfIntegration.isInitialized) {
                setTimeout(() => {
                    this.log('DTF Adapter: Retrying data dispatch...');
                    this.dispatchDataEvent();
                }, 500);
            }
        }

        log(...args) {
            if (this.config.debug) {
                console.log('[DTF Adapter]', ...args);
            }
        }

        // Public API methods
        async fetchAndSetGarmentCost(styleNumber) {
            const cost = await this.fetchBaseGarmentCost(styleNumber);
            if (cost !== null) {
                this.setGarmentCost(cost);
                return cost;
            }
            return null;
        }

        setGarmentCost(cost) {
            this.updatePricingData({ garmentCost: parseFloat(cost) });
        }

        setQuantity(qty) {
            this.updatePricingData({ quantity: parseInt(qty) });
        }

        setProductInfo(info) {
            this.updatePricingData({ productInfo: info });
        }

        getData() {
            return this.currentData;
        }
    }

    // Initialize adapter
    const dtfAdapter = new DTFCaspioAdapter();

    // Make adapter available globally
    window.dtfCaspioAdapter = dtfAdapter;

    // Also expose simple API for external use
    window.DTFAdapter = {
        setGarmentCost: (cost) => dtfAdapter.setGarmentCost(cost),
        setQuantity: (qty) => dtfAdapter.setQuantity(qty),
        setProductInfo: (info) => dtfAdapter.setProductInfo(info),
        updateData: (data) => dtfAdapter.updatePricingData(data),
        getData: () => dtfAdapter.getData(),
        fetchAndSetGarmentCost: (styleNumber) => dtfAdapter.fetchAndSetGarmentCost(styleNumber)
    };

})();