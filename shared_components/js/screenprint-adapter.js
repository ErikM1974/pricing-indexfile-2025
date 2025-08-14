// Screen Print Adapter - Extends BaseAdapter
// Handles Caspio integration and data processing for screen printing

console.log("[ADAPTER:SCREENPRINT] Screen Print Adapter loaded. Master Bundle Version with BaseAdapter.");

(function() {
    "use strict";

    // Screen Print Adapter extends BaseAdapter
    class ScreenPrintAdapter extends BaseAdapter {
        constructor() {
            super('screenprint', {
                appKey: 'a0e150002eb9491a50104c1d99d7',
                debug: true,
                errorMessageId: 'caspio-screenprint-error-message',
                fallbackUIId: 'pricing-fallback',
                timeout: 10000
            });
            
            // Screen print specific state
            this.config = window.ScreenPrintConfig || {};
            this.currentColorCount = '1';
        }

        // Override initialization to set up screen print specific features
        async init() {
            this.debugLog('Initializing Screen Print adapter...');
            
            try {
                // Call parent initialization
                await super.init();
                
                this.debugLog('Screen Print adapter initialization complete');
                
            } catch (error) {
                this.handleError('Screen Print adapter initialization failed', error);
            }
        }
    
        // Override data loading for screen print specific Caspio integration
        async loadData() {
            const styleNumber = typeof NWCAUtils !== 'undefined' ? NWCAUtils.getUrlParameter('StyleNumber') : null;
            const colorName = (typeof NWCAUtils !== 'undefined' && NWCAUtils.getUrlParameter('COLOR')) ? 
                decodeURIComponent(NWCAUtils.getUrlParameter('COLOR').replace(/\+/g, ' ')) : null;
            
            this.debugLog('Loading Screen Print data for:', { styleNumber, colorName });
            
            if (!styleNumber) {
                this.handleError("Product style not specified in URL. Pricing cannot be loaded.");
                return;
            }

            // For screen print, we don't load a Caspio datapage directly
            // Instead we wait for messages from the parent window
            this.debugLog('Screen Print adapter ready to receive pricing data');
        }

        // Override specific data processing for screen print
        async processSpecificData(masterBundle) {
            this.debugLog('Processing Screen Print specific data');
            
            // Check if we're getting the shortened field names from Caspio
            if (masterBundle.sN && !masterBundle.styleNumber) {
                this.debugLog('Converting shortened field names');
                masterBundle.styleNumber = masterBundle.sN;
                masterBundle.colorName = masterBundle.cN;
                masterBundle.productTitle = masterBundle.pT;
            }
            
            // Log specific fields for debugging
            this.debugLog('Field check:', {
                styleNumber: masterBundle.styleNumber,
                colorName: masterBundle.colorName,
                productTitle: masterBundle.productTitle,
                hasTierData: !!masterBundle.tierData,
                hasPrimaryLocationPricing: !!masterBundle.primaryLocationPricing,
                uniqueSizes: masterBundle.uniqueSizes
            });
            
            // Notify other components that adapter is ready
            document.dispatchEvent(new CustomEvent('screenPrintAdapterReady', { 
                detail: { success: true } 
            }));
            
            // Wait for UI to initialize and set default values, then process
            setTimeout(() => {
                this.debugLog('Processing pricing data after UI initialization');
                this.processPricingData();
            }, 100);
        }
    
        // Process pricing data based on current selections
        processPricingData() {
            if (!this.masterBundle) {
                this.debugWarn('No master bundle available');
                return;
            }
            
            // Get current configuration from calculator
            const frontColorSelect = document.getElementById('sp-front-colors');
            const frontColors = frontColorSelect ? frontColorSelect.value : '0';
            
            // For screen print, we always use front colors for the primary location pricing
            // Additional locations have their own pricing structure
            const colorCount = frontColors || '1';
            
            if (!colorCount || colorCount === '0') {
                this.debugLog('No front color count selected');
                return;
            }
            
            this.debugLog('Processing pricing for front colors:', colorCount);
            this.currentColorCount = colorCount;
            
            // Extract pricing for selected color count
            const pricingData = this.extractPricingForColorCount(colorCount);
            
            if (pricingData) {
                // Add front color info
                pricingData.frontColors = parseInt(frontColors) || 0;
                
                // Dispatch pricing data
                document.dispatchEvent(new CustomEvent('pricingDataLoaded', { 
                    detail: pricingData 
                }));
                
                // Update pricing table
                this.updatePricingTable(pricingData);
            }
        }
    
        // Extract pricing for specific color count
        extractPricingForColorCount(colorCount) {
            if (!this.masterBundle) return null;
            
            this.debugLog('=== EXTRACTING PRICING ===');
            this.debugLog('Color count:', colorCount);
            this.debugLog('Master bundle structure:', {
                hasStyleNumber: !!this.masterBundle.styleNumber,
                hasColorName: !!this.masterBundle.colorName,
                hasProductTitle: !!this.masterBundle.productTitle,
                hasTierData: !!this.masterBundle.tierData,
                hasPrimaryLocationPricing: !!this.masterBundle.primaryLocationPricing,
                hasUniqueSizes: !!this.masterBundle.uniqueSizes,
                keys: Object.keys(this.masterBundle)
            });
            
            // Extract basic info from master bundle
            const styleNumber = this.masterBundle.styleNumber || '';
            const color = this.masterBundle.colorName || '';
            const productTitle = this.masterBundle.productTitle || '';
            
            if (!styleNumber && !productTitle) {
                this.debugError('Master bundle missing style/product info');
                return null;
            }
            
            // Get pricing data for the selected color count from primaryLocationPricing
            const colorCountStr = colorCount.toString();
            const pricingProfile = this.masterBundle.primaryLocationPricing && this.masterBundle.primaryLocationPricing[colorCountStr];
            
            if (!pricingProfile) {
                this.debugError(`No pricing found for ${colorCount} colors`);
                return null;
            }
            
            this.debugLog(`Found pricing profile for ${colorCount} colors:`, pricingProfile);
            
            // Extract tiers from the pricing profile
            let tiers = [];
            
            if (pricingProfile.tiers && Array.isArray(pricingProfile.tiers)) {
                pricingProfile.tiers.forEach(tier => {
                    this.debugLog(`Processing tier ${tier.label}:`, tier);
                    
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
            
            this.debugLog('Final tiers:', tiers);
            
            // Get additional location pricing for the color count
            const additionalPricing = this.masterBundle.additionalLocationPricing && 
                                      this.masterBundle.additionalLocationPricing[colorCountStr];
            
            // Format data for components
            const result = {
                embellishmentType: 'screen-print',
                styleNumber: styleNumber,
                color: color,
                productTitle: productTitle,
                uniqueSizes: this.masterBundle.uniqueSizes || [],
                tiers: tiers,
                fees: {
                    setup: pricingProfile.setupFee || (parseInt(colorCount) * (this.config.setupFeePerColor || 30)),
                    flash: pricingProfile.flashChargeTotal || 0
                },
                additionalLocationPricing: additionalPricing || {},
                pricingRules: this.masterBundle.pricingRules || {},
                colorCount: colorCount
            };
            
            this.debugLog('Returning formatted data:', result);
            return result;
        }
    
        // Update pricing table
        updatePricingTable(pricingData) {
            const pricingGrid = document.getElementById('custom-pricing-grid');
            if (!pricingGrid || !pricingData.tiers || pricingData.tiers.length === 0) return;
            
            // Hide initial state
            const initialState = document.getElementById('pricing-initial-state');
            if (initialState) initialState.style.display = 'none';
            
            // Show grid
            pricingGrid.style.display = 'table';
            pricingGrid.style.opacity = '1';
            pricingGrid.style.transform = 'translateY(0)';
            
            this.debugLog('Pricing table updated');
        }
    
        // Override setupEventListeners to add screen print specific events
        setupEventListeners() {
            // Listen for color selection changes from integration
            document.addEventListener('change', (e) => {
                if (e.target.id === 'sp-front-colors' || 
                    e.target.classList.contains('location-select') || 
                    e.target.classList.contains('location-colors-select')) {
                    this.debugLog('Detected change in colors/locations, reprocessing pricing');
                    setTimeout(() => this.processPricingData(), 100);
                }
            });
        }
    
        // Override message handling to handle screen print specific messages
        handleCaspioMessage(event, expectedType) {
            if (!event.data || !event.data.type) {
                return; // Ignore messages without type
            }

            this.debugLog('Message received:', event.data.type);
            
            if (event.data.type === 'caspioScreenPrintMasterBundleReady') {
                if (!event.data.data) {
                    this.debugError('Empty data in Caspio message');
                    this.handleError('Empty data received from Caspio');
                    return;
                }
                
                this.processMasterBundle(event.data.data);
                
            } else if (event.data.type === 'caspioPricingError') {
                this.debugError('Caspio error:', event.data.error);
                this.handleError('Caspio pricing error: ' + event.data.error);
            } else {
                // Handle other message types with parent class method
                super.handleCaspioMessage(event, expectedType);
            }
        }
    
        // Override error handling to show screen print specific errors
        handleError(message, error = null) {
            super.handleError(message, error);
            
            // Show fallback UI for screen print
            const fallback = document.getElementById('pricing-fallback');
            if (fallback) {
                fallback.style.display = 'block';
            }
            
            document.dispatchEvent(new CustomEvent('pricingDataError', { 
                detail: { message: message }
            }));
        }
    
        // Get pricing for specific configuration
        getPricing(colorCount, quantity) {
            if (!this.masterBundle) return null;
            
            const pricingData = this.extractPricingForColorCount(colorCount);
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
    }

    // Global variables for compatibility with existing code
    let screenPrintProcessingMasterBundle = false;
    const EXPECTED_CASPIO_ORIGIN_1 = 'https://c3eku948.caspio.com';
    const EXPECTED_CASPIO_ORIGIN_2 = 'https://nwcustom.caspio.com';
    const EXPECTED_CASPIO_ORIGIN_3 = 'https://www.teamnwca.com';

    // Initialize Screen Print adapter using the new class-based approach
    async function initScreenPrintPricing() {
        console.log("[ADAPTER:SCREENPRINT] Initializing Screen Print pricing adapter (Master Bundle)...");
        
        // Create and initialize the Screen Print adapter instance
        if (!window.screenPrintAdapter) {
            window.screenPrintAdapter = new ScreenPrintAdapter();
        }
        
        await window.screenPrintAdapter.init();
        
        // Setup additional event listeners for screen print
        window.screenPrintAdapter.setupEventListeners();
    }

    // Legacy compatibility wrapper
    window.ScreenPrintAdapter = {
        init: initScreenPrintPricing,
        getPricing: (colorCount, quantity) => {
            if (window.screenPrintAdapter) {
                return window.screenPrintAdapter.getPricing(colorCount, quantity);
            }
        },
        isReady: () => {
            return window.screenPrintAdapter ? window.screenPrintAdapter.hasData() : false;
        },
        processPricingData: () => {
            if (window.screenPrintAdapter) {
                return window.screenPrintAdapter.processPricingData();
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScreenPrintPricing);
    } else {
        initScreenPrintPricing(); 
    }

})();

