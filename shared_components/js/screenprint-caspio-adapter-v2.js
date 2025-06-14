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
        console.log('[CaspioAdapterV2] handleMessage called. Event Origin:', event.origin, 'Event Data:', event.data);

        // Basic check for event data and type
        if (!event.data || typeof event.data !== 'object') {
            console.warn('[CaspioAdapterV2] Received message with no data or non-object data. Ignoring.');
            return;
        }
        
        if (!event.data.type) {
            console.warn('[CaspioAdapterV2] Received message with no type property. Ignoring. Data:', event.data);
            return;
        }

        console.log('[CaspioAdapterV2] Received message with type:', event.data.type);

        if (event.data.type === 'caspioScreenPrintMasterBundleReady') {
            console.log('[CaspioAdapterV2] "caspioScreenPrintMasterBundleReady" message received. Processing bundle...');
            this.processMasterBundle(event.data.data);
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

        // Convert shortened field names from Caspio to full names
        if (data.sN) {
            console.log('[CaspioAdapterV2] Shortened field names (sN) detected. Converting to full names.');
            data.styleNumber = data.sN;
            data.colorName = data.cN;
            data.productTitle = data.pT;
            // Potentially remove old keys if they cause issues, or ensure downstream code handles both
            // delete data.sN; delete data.cN; delete data.pT;
            console.log('[CaspioAdapterV2] Converted master bundle:', JSON.stringify(data, null, 2));
        } else {
            console.log('[CaspioAdapterV2] No shortened field names (sN) detected. Using data as is.');
        }

        // Validate required fields
        if (!data.primaryLocationPricing) {
            console.error('[CaspioAdapterV2] CRITICAL: Missing "primaryLocationPricing" in master bundle. This is essential for pricing.');
            this.dispatchError('Missing primaryLocationPricing in bundle');
            return;
        }
        console.log('[CaspioAdapterV2] "primaryLocationPricing" found in bundle.');

        this.masterBundle = data;
        this.isReady = true;
        console.log('[CaspioAdapterV2] Master bundle processed successfully. isReady is now true.');

        // Dispatch success event
        this.dispatchReady(data);
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