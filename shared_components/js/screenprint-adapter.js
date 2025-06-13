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
        console.log('[ScreenPrintAdapter] === STORING MASTER BUNDLE ===');
        console.log('[ScreenPrintAdapter] Raw data received:', data);
        
        // Only store if we have primaryLocationPricing (full bundle from Caspio)
        // This prevents the fallback extractor from overwriting good data
        if (!data.primaryLocationPricing && masterBundle && masterBundle.primaryLocationPricing) {
            console.log('[ScreenPrintAdapter] Ignoring incomplete bundle - keeping existing full bundle');
            return;
        }
        
        masterBundle = data;
        isReady = true;
        
        // Log the structure for debugging
        console.log('[ScreenPrintAdapter] Master bundle structure analysis:');
        console.log('- Type:', typeof masterBundle);
        console.log('- Is Array:', Array.isArray(masterBundle));
        console.log('- Keys:', Object.keys(masterBundle));
        
        // Check if we're getting the shortened field names from Caspio
        if (masterBundle.sN && !masterBundle.styleNumber) {
            console.log('[ScreenPrintAdapter] Converting shortened field names');
            masterBundle.styleNumber = masterBundle.sN;
            masterBundle.colorName = masterBundle.cN;
            masterBundle.productTitle = masterBundle.pT;
        }
        
        // Log specific fields we're looking for
        console.log('[ScreenPrintAdapter] Field check:');
        console.log('- styleNumber:', masterBundle.styleNumber);
        console.log('- colorName:', masterBundle.colorName);
        console.log('- productTitle:', masterBundle.productTitle);
        console.log('- tierData:', !!masterBundle.tierData);
        console.log('- primaryLocationPricing:', !!masterBundle.primaryLocationPricing);
        console.log('- uniqueSizes:', masterBundle.uniqueSizes);
        
        // Notify other components that adapter is ready
        document.dispatchEvent(new CustomEvent('screenPrintAdapterReady', { 
            detail: { success: true } 
        }));
        
        // Wait for UI to initialize and set default values, then process
        setTimeout(() => {
            console.log('[ScreenPrintAdapter] Processing pricing data after UI initialization');
            processPricingData();
        }, 100);
    }
    
    // Process pricing data based on current selections
    function processPricingData() {
        if (!masterBundle) {
            console.warn('[ScreenPrintAdapter] No master bundle available');
            return;
        }
        
        // Get current configuration from calculator
        const frontColorSelect = document.getElementById('sp-front-colors');
        const frontColors = frontColorSelect ? frontColorSelect.value : '0';
        
        // For screen print, we always use front colors for the primary location pricing
        // Additional locations have their own pricing structure
        const colorCount = frontColors || '1';
        
        if (!colorCount || colorCount === '0') {
            console.log('[ScreenPrintAdapter] No front color count selected');
            return;
        }
        
        console.log('[ScreenPrintAdapter] Processing pricing for front colors:', colorCount);
        
        // Extract pricing for selected color count
        const pricingData = extractPricingForColorCount(colorCount);
        
        if (pricingData) {
            // Add front color info
            pricingData.frontColors = parseInt(frontColors) || 0;
            
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
        
        console.log('[ScreenPrintAdapter] === EXTRACTING PRICING ===');
        console.log('[ScreenPrintAdapter] Color count:', colorCount);
        console.log('[ScreenPrintAdapter] Master bundle structure:', {
            hasStyleNumber: !!masterBundle.styleNumber,
            hasColorName: !!masterBundle.colorName,
            hasProductTitle: !!masterBundle.productTitle,
            hasTierData: !!masterBundle.tierData,
            hasPrimaryLocationPricing: !!masterBundle.primaryLocationPricing,
            hasUniqueSizes: !!masterBundle.uniqueSizes,
            keys: Object.keys(masterBundle)
        });
        
        // Extract basic info from master bundle
        const styleNumber = masterBundle.styleNumber || '';
        const color = masterBundle.colorName || '';
        const productTitle = masterBundle.productTitle || '';
        
        if (!styleNumber && !productTitle) {
            console.error('[ScreenPrintAdapter] Master bundle missing style/product info');
            return null;
        }
        
        // Get pricing data for the selected color count from primaryLocationPricing
        const colorCountStr = colorCount.toString();
        const pricingProfile = masterBundle.primaryLocationPricing && masterBundle.primaryLocationPricing[colorCountStr];
        
        if (!pricingProfile) {
            console.error(`[ScreenPrintAdapter] No pricing found for ${colorCount} colors`);
            return null;
        }
        
        console.log(`[ScreenPrintAdapter] Found pricing profile for ${colorCount} colors:`, pricingProfile);
        
        // Extract tiers from the pricing profile
        let tiers = [];
        
        if (pricingProfile.tiers && Array.isArray(pricingProfile.tiers)) {
            pricingProfile.tiers.forEach(tier => {
                console.log(`[ScreenPrintAdapter] Processing tier ${tier.label}:`, tier);
                
                tiers.push({
                    label: tier.label,
                    minQty: tier.minQty || 0,
                    maxQty: tier.maxQty || 999999,
                    prices: tier.prices || {},
                    ltmFee: tier.ltmFee || 0,
                    TierLabel: tier.label
                });
            });
        }
        
        // Sort tiers by minQty
        tiers.sort((a, b) => a.minQty - b.minQty);
        
        console.log('[ScreenPrintAdapter] Final tiers:', tiers);
        
        // Get additional location pricing for the color count
        const additionalPricing = masterBundle.additionalLocationPricing && 
                                  masterBundle.additionalLocationPricing[colorCountStr];
        
        // Format data for components
        const result = {
            embellishmentType: 'screen-print',
            styleNumber: styleNumber,
            color: color,
            productTitle: productTitle,
            uniqueSizes: masterBundle.uniqueSizes || [],
            tiers: tiers,
            fees: {
                setup: pricingProfile.setupFee || (parseInt(colorCount) * config.setupFeePerColor),
                flash: pricingProfile.flashChargeTotal || 0
            },
            additionalLocationPricing: additionalPricing || {},
            pricingRules: masterBundle.pricingRules || {},
            colorCount: colorCount
        };
        
        console.log('[ScreenPrintAdapter] Returning formatted data:', result);
        return result;
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
            if (e.target.id === 'sp-front-colors' || 
                e.target.classList.contains('location-select') || 
                e.target.classList.contains('location-colors-select')) {
                console.log('[ScreenPrintAdapter] Detected change in colors/locations, reprocessing pricing');
                setTimeout(() => processPricingData(), 100);
            }
        });
        
        // Listen for Caspio messages
        window.addEventListener('message', handleCaspioMessage);
    }
    
    // Handle Caspio messages
    function handleCaspioMessage(event) {
        // Only log messages with actual data
        if (event.data && event.data.type) {
            console.log('[ScreenPrintAdapter] Message received:', event.data.type);
            
            if (event.data.type === 'caspioScreenPrintMasterBundleReady') {
                if (!event.data.data) {
                    console.error('[ScreenPrintAdapter] Empty data in Caspio message');
                    showPricingError();
                    return;
                }
                
                storeMasterBundle(event.data.data);
                
            } else if (event.data.type === 'caspioPricingError') {
                console.error('[ScreenPrintAdapter] Caspio error:', event.data.error);
                showPricingError();
            }
        }
        // Ignore messages without type (reduces console spam)
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