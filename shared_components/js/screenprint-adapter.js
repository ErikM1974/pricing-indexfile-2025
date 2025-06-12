// Screen Print Adapter - Simplified for new architecture
// Handles Caspio integration and data processing

window.ScreenPrintAdapter = (function() {
    'use strict';
    
    const config = window.ScreenPrintConfig;
    let masterBundle = null;
    let isReady = false;
    const CASPIO_TIMEOUT = 10000;
    
    // Initialize adapter
    function init() {
        console.log('[ScreenPrintAdapter] Initializing');
        setupEventListeners();
        startCaspioTimeout();
    }
    
    // Store master bundle from Caspio
    function storeMasterBundle(data) {
        masterBundle = data;
        isReady = true;
        console.log('[ScreenPrintAdapter] Master bundle stored:', masterBundle);
        
        // Process and dispatch initial data
        processPricingData();
        
        // Notify other components
        document.dispatchEvent(new CustomEvent('screenPrintAdapterReady', { 
            detail: { success: true } 
        }));
    }
    
    // Process pricing data based on current selections
    function processPricingData() {
        if (!masterBundle) {
            console.warn('[ScreenPrintAdapter] No master bundle available');
            return;
        }
        
        // Get current configuration from calculator
        const colorSelect = document.getElementById('sp-front-colors');
        const colorCount = colorSelect ? colorSelect.value : '1';
        
        if (!colorCount || colorCount === '0') {
            console.log('[ScreenPrintAdapter] No color count selected');
            return;
        }
        
        // Extract pricing for selected color count
        const pricingData = extractPricingForColorCount(colorCount);
        
        if (pricingData) {
            // Dispatch pricing data
            document.dispatchEvent(new CustomEvent('pricingDataLoaded', { 
                detail: pricingData 
            }));
            
            // Update pricing table
            updatePricingTable(pricingData);
        }
    }
    
    // Extract pricing for specific color count
    function extractPricingForColorCount(colorCount) {
        if (!masterBundle) return null;
        
        // Try to find pricing data in various possible locations
        const possibleKeys = [
            'primaryLocationPricing',
            'primary_location_pricing',
            'screenPrintPricing',
            'pricing'
        ];
        
        let pricingData = null;
        
        for (const key of possibleKeys) {
            if (masterBundle[key] && masterBundle[key][colorCount]) {
                pricingData = masterBundle[key][colorCount];
                break;
            }
        }
        
        // If master bundle has direct tiers, use those
        if (!pricingData && masterBundle.tiers) {
            pricingData = masterBundle;
        }
        
        if (!pricingData) {
            console.error('[ScreenPrintAdapter] No pricing data found for', colorCount, 'colors');
            return null;
        }
        
        // Format data for components
        return {
            embellishmentType: 'screen-print',
            styleNumber: masterBundle.sN || masterBundle.styleNumber || '',
            color: masterBundle.cN || masterBundle.color || '',
            productTitle: masterBundle.pT || masterBundle.productTitle || '',
            uniqueSizes: masterBundle.uniqueSizes || [],
            tiers: formatTiers(pricingData.tiers || []),
            fees: {
                setup: parseInt(colorCount) * config.setupFeePerColor,
                flash: 0 // Included in color count for dark garments
            },
            additionalLocationPricing: masterBundle.additionalLocationPricing || {},
            colorCount: colorCount
        };
    }
    
    // Format tier data
    function formatTiers(tiers) {
        return tiers.map(tier => ({
            label: tier.TierLabel || `${tier.minQty}${tier.maxQty ? '-' + tier.maxQty : '+'}`,
            minQty: tier.minQty || 0,
            maxQty: tier.maxQty || null,
            prices: tier.prices || {},
            ltmFee: tier.LTM_Fee || 0,
            TierLabel: tier.TierLabel // Keep for compatibility
        }));
    }
    
    // Update pricing table
    function updatePricingTable(pricingData) {
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid || !pricingData.tiers || pricingData.tiers.length === 0) return;
        
        // Hide initial state
        const initialState = document.getElementById('pricing-initial-state');
        if (initialState) initialState.style.display = 'none';
        
        // Show grid
        pricingGrid.style.display = 'table';
        pricingGrid.style.opacity = '1';
        pricingGrid.style.transform = 'translateY(0)';
        
        console.log('[ScreenPrintAdapter] Pricing table updated');
    }
    
    // Setup event listeners
    function setupEventListeners() {
        // Listen for color selection changes from integration
        document.addEventListener('change', (e) => {
            if (e.target.id === 'sp-front-colors' || e.target.id === 'sp-back-colors') {
                setTimeout(() => processPricingData(), 100);
            }
        });
        
        // Listen for Caspio messages
        window.addEventListener('message', handleCaspioMessage);
    }
    
    // Handle Caspio messages
    function handleCaspioMessage(event) {
        console.log('[ScreenPrintAdapter] Message received:', event.data?.type);
        
        if (event.data && event.data.type === 'caspioScreenPrintMasterBundleReady') {
            if (!event.data.data) {
                console.error('[ScreenPrintAdapter] Empty data in Caspio message');
                showPricingError();
                return;
            }
            
            storeMasterBundle(event.data.data);
            
        } else if (event.data && event.data.type === 'caspioPricingError') {
            console.error('[ScreenPrintAdapter] Caspio error:', event.data.error);
            showPricingError();
        }
    }
    
    // Show pricing error
    function showPricingError() {
        const fallback = document.getElementById('pricing-fallback');
        if (fallback) {
            fallback.style.display = 'block';
        }
        
        document.dispatchEvent(new CustomEvent('pricingDataError', { 
            detail: { message: 'Failed to load pricing data' }
        }));
    }
    
    // Start timeout for Caspio
    function startCaspioTimeout() {
        setTimeout(() => {
            if (!isReady) {
                console.error('[ScreenPrintAdapter] Caspio timeout');
                showPricingError();
            }
        }, CASPIO_TIMEOUT);
    }
    
    // Get pricing for specific configuration
    function getPricing(colorCount, quantity) {
        if (!masterBundle) return null;
        
        const pricingData = extractPricingForColorCount(colorCount);
        if (!pricingData) return null;
        
        // Find appropriate tier
        const tier = pricingData.tiers.find(t => 
            quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty)
        );
        
        if (!tier) return null;
        
        // Get base price (use first size as default)
        const sizes = Object.keys(tier.prices);
        const basePrice = tier.prices[sizes[0]] || 0;
        
        return {
            unitPrice: basePrice,
            setupFee: pricingData.fees.setup,
            tier: tier
        };
    }
    
    // Public API
    return {
        init,
        getPricing,
        isReady: () => isReady,
        processPricingData
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ScreenPrintAdapter.init());
} else {
    ScreenPrintAdapter.init();
}