// Cap Master Bundle Integration
// Handles postMessage communication with Caspio iframe and transforms data for UI

(function() {
    'use strict';

    console.log('[CAP-MASTER-BUNDLE] Integration handler loaded');

    // Data transformer function - converts master bundle to UI format
    function transformCapMasterBundle(masterBundle) {
        if (!masterBundle || masterBundle.hasError) {
            console.error('[CAP-MASTER-BUNDLE] Invalid or error bundle received');
            return null;
        }

        // For caps, use actual sizes without grouping (OSFA, S/M, M/L, L/XL, etc.)
        const headers = masterBundle.uniqueSizes || [];
        const prices = {};
        const tiers = Array.isArray(masterBundle.tierData) ? masterBundle.tierData : Object.values(masterBundle.tierData);
        
        // Initialize prices structure
        headers.forEach(h => prices[h] = {});
        
        // Process each tier
        tiers.forEach(tier => {
            const tierLabel = tier.TierLabel;
            
            // For each size, get the price from the master bundle
            headers.forEach(size => {
                if (masterBundle.pricing && 
                    masterBundle.pricing[tierLabel] && 
                    masterBundle.pricing[tierLabel][size] !== undefined) {
                    prices[size][tierLabel] = masterBundle.pricing[tierLabel][size];
                } else {
                    prices[size][tierLabel] = null;
                    console.warn(`[CAP-MASTER-BUNDLE] No price found for size: ${size}, tier: ${tierLabel}`);
                }
            });
        });

        // Return the final object for UI components
        return {
            headers: headers,
            prices: prices,
            tierData: masterBundle.tierData,
            uniqueSizes: masterBundle.uniqueSizes,
            styleNumber: masterBundle.styleNumber,
            color: masterBundle.colorName || masterBundle.color,
            embellishmentType: masterBundle.embellishmentType,
            rulesData: masterBundle.rulesData,
            sellingPriceDisplayAddOns: masterBundle.sellingPriceDisplayAddOns,
            printLocationMeta: masterBundle.printLocationMeta,
            standardGarmentBaseCostUsed: masterBundle.standardGarmentBaseCostUsed
        };
    }

    // Listen for postMessage from Caspio iframe
    window.addEventListener('message', function(event) {
        // Optional security check (uncomment and update domain if needed)
        // if (event.origin !== 'https://c3eku948.caspio.com') return;

        // Only process messages with a type property
        if (!event.data || !event.data.type) return;

        console.log('[CAP-MASTER-BUNDLE] Received message:', event.data.type);

        if (event.data.type === 'caspioCapMasterBundleReady') {
            // SUCCESS - Process the master bundle
            const masterBundle = event.data.detail;
            console.log('[CAP-MASTER-BUNDLE] Master bundle received:', masterBundle);

            // Transform the data for UI
            const transformedData = transformCapMasterBundle(masterBundle);
            
            if (transformedData) {
                console.log('[CAP-MASTER-BUNDLE] Transformed data:', transformedData);
                
                // Store globally for debugging
                window.nwcaCapMasterBundleData = masterBundle;
                window.nwcaCapTransformedData = transformedData;
                
                // Dispatch event for cap pricing v3 component
                const bundleEvent = new CustomEvent('capMasterBundleLoaded', {
                    detail: {
                        raw: masterBundle,
                        transformed: transformedData
                    },
                    bubbles: true
                });
                document.dispatchEvent(bundleEvent);
                
                // Skip legacy pricingDataLoaded event for cap embroidery
                // Cap embroidery pricing v3 handles its own table rendering
                // and dp5-helper's updateCustomPricingGrid was overwriting it
                console.log('[CAP-MASTER-BUNDLE] Bundle event dispatched successfully');
                console.log('[CAP-MASTER-BUNDLE] Skipping legacy pricingDataLoaded event to prevent dp5-helper interference');
                
                // Set flag to prevent other systems from triggering fallback
                window.CAP_MASTER_BUNDLE_LOADED = true;
                window.CAP_MASTER_BUNDLE_MODE = true;
            } else {
                console.error('[CAP-MASTER-BUNDLE] Data transformation failed');
            }
            
        } else if (event.data.type === 'caspioCapMasterBundleFailed' || 
                   (event.data.type && event.data.type.includes('Failed'))) {
            // FAILURE - Handle error
            const errorInfo = event.data.detail || {};
            console.error('[CAP-MASTER-BUNDLE] Caspio error:', errorInfo.errorMessage || 'Unknown error');
            
            // Dispatch error event
            const errorEvent = new CustomEvent('capMasterBundleError', {
                detail: {
                    error: errorInfo.errorMessage || 'Failed to load pricing data',
                    hasError: true
                },
                bubbles: true
            });
            document.dispatchEvent(errorEvent);
            
            // Show error in UI if possible
            const pricingContainer = document.getElementById('pricing-grid-container');
            if (pricingContainer) {
                pricingContainer.innerHTML = `
                    <div class="error-message" style="padding: 20px; text-align: center; color: #d32f2f;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <p>Unable to load cap pricing data. Please refresh the page or contact support.</p>
                        <p style="font-size: 14px; color: #666; margin-top: 10px;">${errorInfo.errorMessage || ''}</p>
                    </div>
                `;
            }
        }
    });

    // Export transformer function for testing
    window.transformCapMasterBundle = transformCapMasterBundle;

    console.log('[CAP-MASTER-BUNDLE] Ready to receive master bundle data');

})();