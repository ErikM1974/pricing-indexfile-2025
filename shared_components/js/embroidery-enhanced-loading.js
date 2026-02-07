// Enhanced loading for embroidery pricing pages
(function() {
    'use strict';
    
    // Enhanced loading simulation
    function simulateEnhancedLoading() {
        const loadingSteps = [
            { progress: 15, status: 'Loading your custom pricing...', step: 'Connecting to pricing database...' },
            { progress: 30, status: 'Processing your request...', step: 'Fetching embroidery pricing data...' },
            { progress: 50, status: 'Calculating pricing tiers...', step: 'Processing quantity discounts...' },
            { progress: 70, status: 'Loading size information...', step: 'Preparing size-specific pricing...' },
            { progress: 85, status: 'Finalizing your pricing...', step: 'Applying final calculations...' },
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
                setTimeout(updateProgress, 800 + Math.random() * 400);
            }
        };
        
        // Start the simulation
        setTimeout(updateProgress, 500);
    }
    
    // Enhanced show loading state function
    function showEnhancedLoadingState() {
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
    
    // Hook into the Caspio loading process
    function hookCaspioLoading() {
        // Watch for Caspio loading start
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const target = mutation.target;
                    if (target && target.id === 'pricing-calculator') {
                        const hasLoadingMessage = target.querySelector('.loading-message');
                        if (hasLoadingMessage && target.classList.contains('loading')) {
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
        
        // Also listen for pricingDataLoaded event
        window.addEventListener('pricingDataLoaded', function(event) {
            setTimeout(() => {
                hideLoadingShowTable();
            }, 1000); // Small delay to show completion
        });
    }
    
    // Initialize when DOM is ready
    function initialize() {
        hookCaspioLoading();
        
        // If page already has data, hide initial state
        if (window.nwcaPricingData) {
            hideLoadingShowTable();
        }
    }
    
    // Export functions
    window.EmbroideryEnhancedLoading = {
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