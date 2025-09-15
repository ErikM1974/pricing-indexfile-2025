/**
 * DTF Integration Layer
 * Coordinates between DTF calculator, Caspio adapter, and external data
 */
class DTFIntegration {
    constructor() {
        this.calculator = null;
        this.isInitialized = false;
        this.init();
    }

    init() {
        // Wait for DOM to be ready AND a small delay for other scripts
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.setupIntegration(), 100);
            });
        } else {
            // Even if DOM is ready, wait a bit for dynamic content
            setTimeout(() => this.setupIntegration(), 100);
        }
    }

    setupIntegration() {
        console.log('DTF Integration: Initializing...');

        // Check if container exists
        const container = document.getElementById('dtf-calculator-container');
        if (!container) {
            console.error('DTF Integration: Calculator container not found');
            return;
        }

        // Initialize calculator
        this.calculator = new DTFPricingCalculator('dtf-calculator-container');
        this.isInitialized = true;

        // Listen for Caspio data events
        this.listenForCaspioData();

        // Listen for calculator events
        this.listenForCalculatorEvents();

        console.log('DTF Integration: Setup complete');
    }

    listenForCaspioData() {
        // Listen for DTF adapter events
        window.addEventListener('dtfAdapterDataReceived', (event) => {
            console.log('DTF Integration: Received adapter data', event.detail);
            this.handleCaspioData(event.detail);
        });

        // Also listen for generic Caspio data events (backward compatibility)
        window.addEventListener('caspioDataReceived', (event) => {
            if (event.detail && event.detail.type === 'dtf') {
                console.log('DTF Integration: Received Caspio data', event.detail);
                this.handleCaspioData(event.detail);
            }
        });
    }

    handleCaspioData(data) {
        if (!this.calculator || !this.isInitialized) {
            console.error('DTF Integration: Calculator not initialized, retrying in 250ms');
            // Retry after a short delay if calculator isn't ready
            setTimeout(() => {
                if (this.calculator && this.isInitialized) {
                    this.handleCaspioData(data);
                }
            }, 250);
            return;
        }

        console.log('DTF Integration: Processing data:', data);

        // Track if this is a style/product change
        const isStyleChange = data.productInfo && data.productInfo.sku &&
                            this.lastProductSku !== data.productInfo.sku;

        // Update garment cost - this will trigger transfer recalculation automatically
        if (data.garmentCost !== undefined) {
            console.log('DTF Integration: Updating garment cost to:', data.garmentCost);
            this.calculator.updateGarmentCost(data.garmentCost);
        }

        // Update quantity - this will also trigger recalculation
        if (data.quantity !== undefined) {
            this.calculator.updateQuantity(data.quantity);
        }

        // Update freight (only if not using automatic freight calculation)
        if (data.freight !== undefined && !DTFConfig.settings.includeFreightInTransfers) {
            this.calculator.updateFreight(data.freight);
        }

        // Update LTM fee
        if (data.ltmFee !== undefined) {
            this.calculator.updateLTMFee(data.ltmFee);
        }

        // Handle any additional product data
        if (data.productInfo) {
            this.updateProductDisplay(data.productInfo);
            this.lastProductSku = data.productInfo.sku;
        }

        // Force a complete refresh if this is a style change
        if (isStyleChange && this.calculator.refreshTransferPricing) {
            console.log('DTF Integration: Style changed, forcing complete pricing refresh');
            setTimeout(() => {
                this.calculator.refreshTransferPricing();
            }, 50); // Small delay to ensure all data is updated
        }
    }

    listenForCalculatorEvents() {
        const container = document.getElementById('dtf-calculator-container');
        if (!container) return;

        // Listen for pricing updates from calculator
        container.addEventListener('dtfPricingUpdated', (event) => {
            console.log('DTF Integration: Pricing updated', event.detail);
            
            // Dispatch global event that other components can listen to
            window.dispatchEvent(new CustomEvent('dtfPricingCalculated', {
                detail: event.detail,
                bubbles: true
            }));

            // Update any external displays if needed
            this.updateExternalDisplays(event.detail);
        });
    }

    updateProductDisplay(productInfo) {
        // Update product name if element exists
        const productNameEl = document.getElementById('dtf-product-name');
        if (productNameEl && productInfo.name) {
            productNameEl.textContent = productInfo.name;
        }

        // Update product image if element exists
        const productImageEl = document.getElementById('dtf-product-image');
        if (productImageEl && productInfo.image) {
            productImageEl.src = productInfo.image;
            productImageEl.alt = productInfo.name || 'Product Image';
        }

        // Update SKU if element exists
        const skuEl = document.getElementById('dtf-product-sku');
        if (skuEl && productInfo.sku) {
            skuEl.textContent = `SKU: ${productInfo.sku}`;
        }
    }

    updateExternalDisplays(pricing) {
        // Update any external price displays
        const externalPriceEl = document.querySelector('.dtf-external-price');
        if (externalPriceEl) {
            externalPriceEl.textContent = `$${pricing.totalPerShirt.toFixed(2)}`;
        }

        // Update any external total displays
        const externalTotalEl = document.querySelector('.dtf-external-total');
        if (externalTotalEl) {
            externalTotalEl.textContent = `$${pricing.totalOrder.toFixed(2)}`;
        }
    }

    // Public methods for manual control
    updateData(data) {
        this.handleCaspioData(data);
    }

    reset() {
        if (this.calculator) {
            // Reinitialize calculator
            this.calculator.init();
        }
    }

    getCalculator() {
        return this.calculator;
    }
}

// Initialize integration when script loads
const dtfIntegration = new DTFIntegration();

// Make integration available globally
window.dtfIntegration = dtfIntegration;