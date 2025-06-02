// Hero Quantity Calculator - Quantity-First UX for Cap Embroidery
// Provides immediate pricing feedback and tier optimization
(function() {
    'use strict';

    console.log('[HERO-CALC] Hero Quantity Calculator initializing...');

    // Configuration
    const HERO_CONFIG = {
        defaultQuantity: 50,
        minQuantity: 1,
        maxQuantity: 10000,
        incrementStep: 1,
        ltmThreshold: 24,
        ltmFee: 50.00,
        tierThresholds: {
            tier1: { min: 1, max: 11, next: 12 },
            tier2: { min: 12, max: 23, next: 24 },
            tier3: { min: 24, max: 47, next: 48 },
            tier4: { min: 48, max: 71, next: 72 },
            tier5: { min: 72, max: 999999, next: null }
        }
    };

    // State management
    const heroState = {
        currentQuantity: HERO_CONFIG.defaultQuantity,
        currentStitchCount: 8000,
        backLogoEnabled: false,
        backLogoPrice: 0,
        pricingData: null,
        tierPrices: {}
    };

    // Main Hero Calculator Object
    const HeroQuantityCalculator = {
        
        /**
         * Initialize the hero quantity calculator
         */
        initialize() {
            console.log('[HERO-CALC] Initializing hero quantity calculator');
            
            // Wait for pricing data to be available
            this.waitForPricingData().then(() => {
                this.setupUI();
                this.setupStitchCountListener();
                this.updateDisplay();
            });
            
            // Listen for pricing data updates
            window.addEventListener('pricingDataUpdated', (event) => {
                console.log('[HERO-CALC] Pricing data updated, refreshing display');
                if (event.detail && event.detail.stitchCount) {
                    heroState.currentStitchCount = parseInt(event.detail.stitchCount);
                    console.log('[HERO-CALC] Updated stitch count to:', heroState.currentStitchCount);
                }
                this.extractTierPrices();
                this.updateDisplay();
            });
            
            // Listen for back logo changes
            window.addEventListener('backLogoChanged', (event) => {
                console.log('[HERO-CALC] Back logo changed, updating calculations');
                this.updateBackLogoState();
                this.updateDisplay();
            });
        },

        /**
         * Wait for pricing data to become available
         */
        async waitForPricingData() {
            return new Promise((resolve) => {
                const checkData = () => {
                    if (window.nwcaPricingData && window.nwcaPricingData.prices) {
                        heroState.pricingData = window.nwcaPricingData;
                        this.extractTierPrices();
                        console.log('[HERO-CALC] Pricing data loaded:', heroState.tierPrices);
                        resolve();
                    } else {
                        setTimeout(checkData, 100);
                    }
                };
                checkData();
            });
        },

        /**
         * Extract tier pricing from pricing data for current stitch count
         */
        extractTierPrices() {
            if (!heroState.pricingData || !heroState.pricingData.prices) {
                // Try to get pricing data from cap embroidery controller
                if (window.nwcaPricingData && window.nwcaPricingData.prices) {
                    heroState.pricingData = window.nwcaPricingData;
                } else {
                    console.warn('[HERO-CALC] No pricing data available');
                    return;
                }
            }
            
            const prices = heroState.pricingData.prices;
            heroState.tierPrices = {};
            
            // Use pricing data for current stitch count if available
            if (window.capEmbroideryMasterData && window.capEmbroideryMasterData.allPriceProfiles) {
                const stitchCountData = window.capEmbroideryMasterData.allPriceProfiles[heroState.currentStitchCount];
                if (stitchCountData) {
                    // Use first size category for stitch count specific pricing
                    const firstSizeKey = Object.keys(stitchCountData)[0];
                    if (firstSizeKey && stitchCountData[firstSizeKey]) {
                        const sizeCategory = stitchCountData[firstSizeKey];
                        Object.keys(sizeCategory).forEach(tierKey => {
                            const price = parseFloat(sizeCategory[tierKey]);
                            if (!isNaN(price)) {
                                heroState.tierPrices[tierKey] = price;
                            }
                        });
                        console.log(`[HERO-CALC] Extracted stitch-count-specific tier prices for ${heroState.currentStitchCount} stitches:`, heroState.tierPrices);
                        return;
                    }
                }
            }
            
            // Fallback to general pricing data
            const firstSizeKey = Object.keys(prices)[0];
            if (firstSizeKey && prices[firstSizeKey]) {
                const sizeCategory = prices[firstSizeKey];
                
                // Map tier keys to our simplified tier structure
                Object.keys(sizeCategory).forEach(tierKey => {
                    const price = parseFloat(sizeCategory[tierKey]);
                    if (!isNaN(price)) {
                        heroState.tierPrices[tierKey] = price;
                    }
                });
            }
            
            console.log('[HERO-CALC] Extracted tier prices:', heroState.tierPrices);
        },

        /**
         * Setup UI event listeners
         */
        setupUI() {
            console.log('[HERO-CALC] Setting up UI event listeners');
            
            const quantityInput = document.getElementById('hero-quantity-input');
            const decreaseBtn = document.getElementById('hero-quantity-decrease');
            const increaseBtn = document.getElementById('hero-quantity-increase');
            
            if (!quantityInput || !decreaseBtn || !increaseBtn) {
                console.error('[HERO-CALC] Hero UI elements not found');
                return;
            }
            
            // Quantity input change
            quantityInput.addEventListener('input', (e) => {
                let quantity = parseInt(e.target.value) || HERO_CONFIG.defaultQuantity;
                quantity = Math.max(HERO_CONFIG.minQuantity, Math.min(HERO_CONFIG.maxQuantity, quantity));
                this.setQuantity(quantity);
            });
            
            // Decrease button
            decreaseBtn.addEventListener('click', () => {
                const newQuantity = Math.max(HERO_CONFIG.minQuantity, heroState.currentQuantity - HERO_CONFIG.incrementStep);
                this.setQuantity(newQuantity);
            });
            
            // Increase button
            increaseBtn.addEventListener('click', () => {
                const newQuantity = Math.min(HERO_CONFIG.maxQuantity, heroState.currentQuantity + HERO_CONFIG.incrementStep);
                this.setQuantity(newQuantity);
            });
            
            console.log('[HERO-CALC] UI event listeners attached');
        },

        /**
         * Setup stitch count listener for quick quote updates
         */
        setupStitchCountListener() {
            console.log('[HERO-CALC] Setting up stitch count listener for quick quote updates');
            
            const stitchCountSelect = document.getElementById('client-stitch-count-select');
            if (stitchCountSelect) {
                // Update initial stitch count
                heroState.currentStitchCount = parseInt(stitchCountSelect.value) || 8000;
                console.log('[HERO-CALC] Initial stitch count:', heroState.currentStitchCount);
                
                // Listen for changes
                stitchCountSelect.addEventListener('change', (e) => {
                    const newStitchCount = parseInt(e.target.value) || 8000;
                    heroState.currentStitchCount = newStitchCount;
                    console.log('[HERO-CALC] Stitch count changed to:', newStitchCount);
                    
                    // Show visual feedback in quick quote
                    this.showStitchCountUpdated();
                    
                    // Update display after short delay for pricing data to update
                    setTimeout(() => {
                        this.updateDisplay();
                    }, 200);
                });
                
                console.log('[HERO-CALC] Stitch count listener attached');
            } else {
                console.warn('[HERO-CALC] Stitch count selector not found');
            }
        },

        /**
         * Show visual feedback when stitch count updates
         */
        showStitchCountUpdated() {
            const stitchDisplayEl = document.querySelector('.quick-quote-banner div[style*="font-size: 0.75em"]');
            if (stitchDisplayEl) {
                const formattedCount = heroState.currentStitchCount.toLocaleString();
                stitchDisplayEl.innerHTML = `Pricing based on <strong style="color: #2e5827;">${formattedCount}</strong> stitches ✓`;
                
                // Reset to normal after 2 seconds
                setTimeout(() => {
                    stitchDisplayEl.innerHTML = `Pricing based on ${formattedCount} stitches`;
                }, 2000);
            }
        },

        /**
         * Set quantity and update display
         */
        setQuantity(quantity) {
            heroState.currentQuantity = quantity;
            
            // Update input field
            const quantityInput = document.getElementById('hero-quantity-input');
            if (quantityInput) {
                quantityInput.value = quantity;
            }
            
            this.updateDisplay();
            
            // Notify other components
            window.dispatchEvent(new CustomEvent('heroQuantityChanged', {
                detail: { quantity: quantity }
            }));
        },

        /**
         * Update back logo state from cap embroidery controller
         */
        updateBackLogoState() {
            if (window.capEmbroideryBackLogo) {
                heroState.backLogoEnabled = window.capEmbroideryBackLogo.isEnabled();
                heroState.backLogoPrice = heroState.backLogoEnabled ? window.capEmbroideryBackLogo.getPricePerItem() : 0;
            }
        },

        /**
         * Determine pricing tier for given quantity
         */
        getTierForQuantity(quantity) {
            for (const [tierName, tier] of Object.entries(HERO_CONFIG.tierThresholds)) {
                if (quantity >= tier.min && quantity <= tier.max) {
                    return { name: tierName, ...tier };
                }
            }
            return null;
        },

        /**
         * Get price per unit for given quantity
         */
        getPriceForQuantity(quantity) {
            const tier = this.getTierForQuantity(quantity);
            if (!tier) return 0;
            
            // Find matching tier price
            for (const [tierKey, price] of Object.entries(heroState.tierPrices)) {
                // Match tier key patterns like "24-47", "48-71", etc.
                if (tierKey.includes(`${tier.min}-`) || 
                    (tier.name === 'tier5' && tierKey.includes('72'))) {
                    return price;
                }
            }
            
            // Fallback pricing if no match found
            const fallbackPrices = { tier1: 15.00, tier2: 14.00, tier3: 12.50, tier4: 11.50, tier5: 10.50 };
            return fallbackPrices[tier.name] || 12.50;
        },

        /**
         * Calculate total pricing including all fees
         */
        calculateTotalPricing(quantity) {
            const basePrice = this.getPriceForQuantity(quantity);
            let unitPrice = basePrice;
            
            // Add LTM fee if under threshold
            let ltmFeePerUnit = 0;
            if (quantity < HERO_CONFIG.ltmThreshold) {
                ltmFeePerUnit = HERO_CONFIG.ltmFee / quantity;
                unitPrice += ltmFeePerUnit;
            }
            
            // Add back logo fee
            if (heroState.backLogoEnabled) {
                unitPrice += heroState.backLogoPrice;
            }
            
            const totalPrice = unitPrice * quantity;
            
            return {
                quantity: quantity,
                basePrice: basePrice,
                ltmFeePerUnit: ltmFeePerUnit,
                backLogoPrice: heroState.backLogoPrice,
                unitPrice: unitPrice,
                totalPrice: totalPrice,
                tier: this.getTierForQuantity(quantity),
                hasLTMFee: quantity < HERO_CONFIG.ltmThreshold
            };
        },

        /**
         * Get optimization suggestions
         */
        getOptimizationSuggestion(quantity) {
            const currentTier = this.getTierForQuantity(quantity);
            if (!currentTier || !currentTier.next) return null;
            
            const nextTierQuantity = currentTier.next;
            const currentPricing = this.calculateTotalPricing(quantity);
            const nextTierPricing = this.calculateTotalPricing(nextTierQuantity);
            
            const additionalCaps = nextTierQuantity - quantity;
            const currentTotal = currentPricing.totalPrice;
            const nextTierTotal = nextTierPricing.totalPrice;
            const savings = (currentPricing.unitPrice - nextTierPricing.unitPrice) * quantity;
            
            if (savings > 0) {
                return {
                    additionalCaps: additionalCaps,
                    nextTierQuantity: nextTierQuantity,
                    savings: savings,
                    newUnitPrice: nextTierPricing.unitPrice,
                    message: `Add ${additionalCaps} more caps for Tier ${currentTier.name.slice(-1)} pricing and save $${savings.toFixed(2)}!`
                };
            }
            
            return null;
        },

        /**
         * Update the hero display with current pricing
         */
        updateDisplay() {
            const pricing = this.calculateTotalPricing(heroState.currentQuantity);
            
            // Update total price
            const totalPriceEl = document.getElementById('hero-total-price');
            if (totalPriceEl) {
                totalPriceEl.textContent = `$${pricing.totalPrice.toFixed(2)} TOTAL`;
            }
            
            // Update unit price
            const unitPriceEl = document.getElementById('hero-unit-price');
            if (unitPriceEl) {
                unitPriceEl.textContent = `$${pricing.unitPrice.toFixed(2)} per cap`;
            }
            
            // Update tier info
            const tierInfoEl = document.getElementById('hero-tier-info');
            if (tierInfoEl && pricing.tier) {
                const tierNumber = pricing.tier.name.slice(-1);
                tierInfoEl.innerHTML = `✅ Tier ${tierNumber} Pricing Applied`;
            }
            
            // Update LTM warning
            const ltmWarningEl = document.getElementById('hero-ltm-warning');
            const ltmMessageEl = document.getElementById('ltm-message');
            if (ltmWarningEl && ltmMessageEl) {
                if (pricing.hasLTMFee) {
                    ltmMessageEl.textContent = `Orders under 24 caps include a $${HERO_CONFIG.ltmFee.toFixed(2)} setup fee ($${pricing.ltmFeePerUnit.toFixed(2)} per cap)`;
                    ltmWarningEl.style.display = 'block';
                } else {
                    ltmWarningEl.style.display = 'none';
                }
            }
            
            // Update optimization suggestion
            const optimizationEl = document.getElementById('hero-optimization-tip');
            const optimizationMessageEl = document.getElementById('optimization-message');
            if (optimizationEl && optimizationMessageEl) {
                const suggestion = this.getOptimizationSuggestion(heroState.currentQuantity);
                if (suggestion) {
                    optimizationMessageEl.textContent = suggestion.message;
                    optimizationEl.style.display = 'block';
                } else {
                    optimizationEl.style.display = 'none';
                }
            }
            
            console.log('[HERO-CALC] Display updated:', pricing);
        }
    };

    // Expose to global scope
    window.HeroQuantityCalculator = HeroQuantityCalculator;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => HeroQuantityCalculator.initialize(), 500);
        });
    } else {
        setTimeout(() => HeroQuantityCalculator.initialize(), 500);
    }

    console.log('[HERO-CALC] Hero Quantity Calculator module loaded');

})();