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

        checkForInitialData() {
            // Check URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            
            const garmentCost = urlParams.get('garmentCost') || urlParams.get('cost');
            const quantity = urlParams.get('quantity') || urlParams.get('qty');
            const productName = urlParams.get('productName') || urlParams.get('name');
            const productSku = urlParams.get('sku');
            const productImage = urlParams.get('image');

            let hasData = false;
            const data = {};

            if (garmentCost) {
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

            if (hasData) {
                this.log('DTF Adapter: Found initial URL data', data);
                this.updatePricingData(data);
            }

            // Check for data in sessionStorage
            const storedData = sessionStorage.getItem('dtfPricingData');
            if (storedData) {
                try {
                    const parsedData = JSON.parse(storedData);
                    this.log('DTF Adapter: Found stored data', parsedData);
                    this.updatePricingData(parsedData);
                } catch (e) {
                    this.log('DTF Adapter: Error parsing stored data', e);
                }
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

        updatePricingData(data) {
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

            // Dispatch event for DTF integration
            this.dispatchDataEvent();
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
        getData: () => dtfAdapter.getData()
    };

})();