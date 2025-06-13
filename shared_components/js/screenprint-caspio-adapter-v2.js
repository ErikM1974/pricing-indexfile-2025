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
        window.addEventListener('message', (event) => this.handleMessage(event));
        
        // Set timeout for Caspio load
        setTimeout(() => {
            if (!this.isReady) {
                console.error('[CaspioAdapterV2] Timeout waiting for Caspio data');
                this.dispatchError('Caspio data timeout');
            }
        }, 10000);
    }

    handleMessage(event) {
        // Only process messages with the correct type
        if (!event.data || !event.data.type) return;

        console.log('[CaspioAdapterV2] Received message:', event.data.type);

        if (event.data.type === 'caspioScreenPrintMasterBundleReady') {
            this.processMasterBundle(event.data.data);
        } else if (event.data.type === 'caspioPricingError') {
            console.error('[CaspioAdapterV2] Caspio error:', event.data.error);
            this.dispatchError(event.data.error);
        }
    }

    processMasterBundle(data) {
        if (!data) {
            console.error('[CaspioAdapterV2] Empty master bundle received');
            return;
        }

        console.log('[CaspioAdapterV2] Processing master bundle:', data);

        // Clean up field names if needed
        if (data.sN && !data.styleNumber) {
            data.styleNumber = data.sN;
            data.colorName = data.cN;
            data.productTitle = data.pT;
        }

        // Validate required fields
        if (!data.primaryLocationPricing) {
            console.error('[CaspioAdapterV2] Missing primaryLocationPricing in bundle');
            return;
        }

        this.masterBundle = data;
        this.isReady = true;

        // Dispatch success event
        this.dispatchReady(data);
    }

    dispatchReady(data) {
        document.dispatchEvent(new CustomEvent('screenPrintMasterBundleReady', {
            detail: data
        }));
    }

    dispatchError(error) {
        document.dispatchEvent(new CustomEvent('screenPrintMasterBundleError', {
            detail: { error }
        }));
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