// Enhanced loading for cap embroidery pricing pages
(function() {
    'use strict';
    
    console.log('[CAP-EMBROIDERY-LOADING] Enhanced loading adapter initialized');
    
    // Enhanced loading simulation
    function simulateEnhancedLoading() {
        const loadingSteps = [
            { progress: 15, status: 'Loading your custom pricing...', step: 'Connecting to pricing database...' },
            { progress: 35, status: 'Processing cap embroidery data...', step: 'Fetching stitch count pricing...' },
            { progress: 55, status: 'Calculating quantity tiers...', step: 'Processing volume discounts...' },
            { progress: 75, status: 'Loading cap-specific pricing...', step: 'Applying cap embroidery rates...' },
            { progress: 90, status: 'Finalizing your pricing...', step: 'Preparing final calculations...' },
            { progress: 100, status: 'Complete!', step: 'Your pricing is ready' }
        ];
        
        let currentStep = 0;
        
        const updateProgress = () => {
            if (currentStep >= loadingSteps.length) return;
            
            const step = loadingSteps[currentStep];
            const statusEl = document.getElementById('loading-status');
            const stepEl = document.getElementById('loading-step');
            const progressEl = document.getElementById('loading-progress-bar');
            
            if (statusEl) statusEl.textContent = step.status;
            if (stepEl) stepEl.textContent = step.step;
            if (progressEl) progressEl.style.width = step.progress + '%';
            
            currentStep++;
            
            if (currentStep < loadingSteps.length) {
                setTimeout(updateProgress, 750 + Math.random() * 350);
            }
        };
        
        // Start the simulation
        setTimeout(updateProgress, 600);
    }
    
    // Enhanced show loading state function
    function showEnhancedLoadingState() {
        console.log('[CAP-EMBROIDERY-LOADING] Showing enhanced loading state');
        
        const initialState = document.getElementById('pricing-initial-state');
        const loadingSpinner = document.getElementById('pricing-table-loading');
        const pricingGrid = document.getElementById('custom-pricing-grid');
        
        if (initialState) initialState.style.display = 'none';
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
            // Start enhanced loading simulation
            simulateEnhancedLoading();
        }
        if (pricingGrid) {
            pricingGrid.style.opacity = '0';
            pricingGrid.style.transform = 'translateY(20px)';
        }
    }
    
    // Hide loading and show table with animation
    function hideLoadingShowTable() {
        console.log('[CAP-EMBROIDERY-LOADING] Hiding loading, showing table');
        
        const initialState = document.getElementById('pricing-initial-state');
        const loadingSpinner = document.getElementById('pricing-table-loading');
        const pricingGrid = document.getElementById('custom-pricing-grid');
        
        if (initialState) initialState.style.display = 'none';
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (pricingGrid) {
            pricingGrid.style.display = 'table';
            // Trigger animation after a brief delay
            setTimeout(() => {
                pricingGrid.style.opacity = '1';
                pricingGrid.style.transform = 'translateY(0)';
            }, 100);
        }
    }
    
    // Hook into cap embroidery specific events
    function hookCapEmbroideryLoading() {
        // Watch for stitch count changes which trigger pricing loads
        document.addEventListener('stitchCountChanged', function(event) {
            console.log('[CAP-EMBROIDERY-LOADING] Stitch count changed, showing loading');
            showEnhancedLoadingState();
        });
        
        // Listen for pricing data loaded event
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log('[CAP-EMBROIDERY-LOADING] Pricing data loaded, hiding loading');
            setTimeout(() => {
                hideLoadingShowTable();
            }, 1100); // Moderate delay for cap embroidery
        });
        
        // Watch for Caspio loading changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const target = mutation.target;
                    if (target && target.id === 'pricing-calculator') {
                        const hasLoadingMessage = target.querySelector('.loading-message');
                        if (hasLoadingMessage && target.classList.contains('loading')) {
                            console.log('[CAP-EMBROIDERY-LOADING] Detected Caspio loading start');
                            showEnhancedLoadingState();
                        }
                    }
                }
            });
        });
        
        const pricingCalculator = document.getElementById('pricing-calculator');
        if (pricingCalculator) {
            observer.observe(pricingCalculator, { 
                childList: true, 
                subtree: true, 
                attributes: true, 
                attributeFilter: ['class'] 
            });
        }
    }
    
    // Initialize when DOM is ready
    function initialize() {
        console.log('[CAP-EMBROIDERY-LOADING] Initializing enhanced loading');
        hookCapEmbroideryLoading();
        
        // If page already has data, hide initial state
        if (window.nwcaPricingData) {
            hideLoadingShowTable();
        }
    }
    
    // Export functions
    window.CapEmbroideryEnhancedLoading = {
        showEnhancedLoadingState,
        hideLoadingShowTable,
        simulateEnhancedLoading
    };
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();