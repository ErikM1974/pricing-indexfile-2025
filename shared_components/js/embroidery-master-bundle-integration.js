// Embroidery Master Bundle Integration
// Handles postMessage communication with Caspio iframe and transforms data for UI

(function() {
    'use strict';

    console.log('[EMBROIDERY-MASTER-BUNDLE] Integration handler loaded');

    // Data transformer function - converts master bundle to UI grid format
    function transformMasterBundleForGrid(masterBundle, dtgLocation = 'LC') {
        if (!masterBundle || masterBundle.hasError) {
            console.error('[EMBROIDERY-MASTER-BUNDLE] Invalid or error bundle received');
            return null;
        }

        // Define the UI's desired size groups
        const sizeGroups = {
            'S-XL': ['S', 'M', 'L', 'XL'],
            '2XL': ['2XL', 'XXL'],
            '3XL': ['3XL'],
            '4XL+': ['4XL', '5XL', '6XL']
        };
        
        const headers = Object.keys(sizeGroups);
        const groupedPrices = {};
        const tiers = Array.isArray(masterBundle.tierData) ? masterBundle.tierData : Object.values(masterBundle.tierData);
        
        // Initialize grouped prices structure
        headers.forEach(h => groupedPrices[h] = {});

        // Process each tier
        tiers.forEach(tier => {
            const tierLabel = tier.TierLabel;
            let pricesForTier;

            // Step 1: Get the correct price list based on embellishment type
            if (masterBundle.embellishmentType === 'embroidery') {
                pricesForTier = masterBundle.pricing[tierLabel];
            } else { // 'dtg'
                const dtgPricesByLoc = masterBundle.allLocationPrices[dtgLocation];
                pricesForTier = {};
                if (dtgPricesByLoc) {
                    for (const size in dtgPricesByLoc) {
                        pricesForTier[size] = dtgPricesByLoc[size][tierLabel];
                    }
                }
            }

            // Step 2: Group the prices according to the UI's needs
            headers.forEach(header => {
                let priceForGroup = null;
                for (const size of sizeGroups[header]) {
                    if (pricesForTier && pricesForTier[size] !== undefined) {
                        priceForGroup = pricesForTier[size];
                        break; // Use the first available price for the group
                    }
                }
                groupedPrices[header][tierLabel] = priceForGroup;
            });
        });

        // Return the final object that should be sent to the UI grid
        return {
            headers: headers,
            prices: groupedPrices,
            tierData: masterBundle.tierData,
            uniqueSizes: masterBundle.uniqueSizes,
            styleNumber: masterBundle.styleNumber,
            color: masterBundle.colorName || masterBundle.color,
            embellishmentType: masterBundle.embellishmentType,
            rulesData: masterBundle.rulesData,
            sellingPriceDisplayAddOns: masterBundle.sellingPriceDisplayAddOns,
            printLocationMeta: masterBundle.printLocationMeta
        };
    }

    // Listen for postMessage from Caspio iframe
    window.addEventListener('message', function(event) {
        // Optional security check (uncomment and update domain if needed)
        // if (event.origin !== 'https://c3eku948.caspio.com') return;

        // Only process messages with a type property
        if (!event.data || !event.data.type) return;

        console.log('[EMBROIDERY-MASTER-BUNDLE] Received message:', event.data.type);

        if (event.data.type === 'caspioEmbroideryMasterBundleReady') {
            // SUCCESS - Process the master bundle
            const masterBundle = event.data.detail;
            console.log('[EMBROIDERY-MASTER-BUNDLE] Master bundle received:', masterBundle);

            // Transform the data for UI
            const transformedData = transformMasterBundleForGrid(masterBundle);
            
            if (transformedData) {
                console.log('[EMBROIDERY-MASTER-BUNDLE] Transformed data:', transformedData);
                
                // Store globally for debugging
                window.nwcaMasterBundleData = masterBundle;
                window.nwcaTransformedData = transformedData;
                
                // Dispatch event for existing components
                const pricingEvent = new CustomEvent('pricingDataLoaded', {
                    detail: transformedData,
                    bubbles: true
                });
                document.dispatchEvent(pricingEvent);
                
                // Also dispatch a specific master bundle event
                const bundleEvent = new CustomEvent('masterBundleLoaded', {
                    detail: {
                        raw: masterBundle,
                        transformed: transformedData
                    },
                    bubbles: true
                });
                document.dispatchEvent(bundleEvent);
                
                console.log('[EMBROIDERY-MASTER-BUNDLE] Events dispatched successfully');
                
                // Set flag to prevent other systems from triggering fallback
                window.EMBROIDERY_MASTER_BUNDLE_LOADED = true;
                window.EMBROIDERY_MASTER_BUNDLE_MODE = true;
            } else {
                console.error('[EMBROIDERY-MASTER-BUNDLE] Data transformation failed');
            }
            
        } else if (event.data.type === 'caspioEmbroideryMasterBundleFailed' || 
                   (event.data.type && event.data.type.includes('Failed'))) {
            // FAILURE - Handle error
            const errorInfo = event.data.detail || {};
            console.error('[EMBROIDERY-MASTER-BUNDLE] Caspio error:', errorInfo.errorMessage || 'Unknown error');
            
            // Dispatch error event
            const errorEvent = new CustomEvent('masterBundleError', {
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
                        <p>Unable to load pricing data. Please refresh the page or contact support.</p>
                        <p style="font-size: 14px; color: #666; margin-top: 10px;">${errorInfo.errorMessage || ''}</p>
                    </div>
                `;
            }
        }
    });

    // Export transformer function for testing
    window.transformMasterBundleForGrid = transformMasterBundleForGrid;

    console.log('[EMBROIDERY-MASTER-BUNDLE] Ready to receive master bundle data');

})();