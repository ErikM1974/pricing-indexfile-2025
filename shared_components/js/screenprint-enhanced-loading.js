// Enhanced loading for screen print pricing pages
(function() {
    'use strict';
    
    console.log('[SCREENPRINT-LOADING] Enhanced loading adapter initialized');
    
    // Enhanced loading simulation
    function simulateEnhancedLoading() {
        const loadingSteps = [
            { progress: 20, status: 'Loading your custom pricing...', step: 'Connecting to pricing database...' },
            { progress: 40, status: 'Processing print colors...', step: 'Calculating setup fees and color costs...' },
            { progress: 60, status: 'Loading quantity tiers...', step: 'Processing volume discounts...' },
            { progress: 80, status: 'Finalizing pricing...', step: 'Applying location-specific rates...' },
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
                setTimeout(updateProgress, 700 + Math.random() * 300);
            }
        };
        
        // Start the simulation
        setTimeout(updateProgress, 400);
    }
    
    // Enhanced show loading state function
    function showEnhancedLoadingState() {
        console.log('[SCREENPRINT-LOADING] Showing enhanced loading state');
        
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
        console.log('[SCREENPRINT-LOADING] Hiding loading, showing table');
        
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
    
    // Hook into screen print specific events
    function hookScreenPrintLoading() {
        // Watch for color count changes which trigger pricing loads
        document.addEventListener('colorCountChanged', function(event) {
            console.log('[SCREENPRINT-LOADING] Color count changed, showing loading');
            showEnhancedLoadingState();
        });
        
        // Listen for pricing data loaded event
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log('[SCREENPRINT-LOADING] Pricing data loaded, hiding loading');
            setTimeout(() => {
                hideLoadingShowTable();
            }, 1200); // Slightly longer delay for screen print
        });
        
        // Watch for Caspio loading changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const target = mutation.target;
                    if (target && target.id === 'pricing-calculator') {
                        const hasLoadingMessage = target.querySelector('.loading-message');
                        if (hasLoadingMessage && target.classList.contains('loading')) {
                            console.log('[SCREENPRINT-LOADING] Detected Caspio loading start');
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
        console.log('[SCREENPRINT-LOADING] Initializing enhanced loading');
        hookScreenPrintLoading();
        
        // If page already has data, hide initial state
        if (window.nwcaPricingData) {
            hideLoadingShowTable();
        }
    }
    
    // Export functions
    window.ScreenPrintEnhancedLoading = {
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