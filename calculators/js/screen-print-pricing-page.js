/* screen-print-pricing-page.js — style search, calculator boot and the console test/debug helpers
 * (SCREENPRINT_API_TEST / SCREENPRINT_DEBUG) for /calculators/screen-print-pricing.html. Extracted 2026-09-06
 * from the page's second inline <script> (Rule 3). Runs AFTER screenprint-pricing-v2.js. */
/* Debug logging gate — this is a staff calculator; the chatter (37 + 30 console.log lines across the two
 * page scripts) only prints on localhost or with ?debug=1. console.error / console.warn stay live. */
var SP_DEBUG = window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug');
var spLog = SP_DEBUG ? console.log.bind(console) : function () {};

(function () {
    // Screen Print API Testing Utilities
    window.SCREENPRINT_API_TEST = {
        // Test API endpoint
        testAPI: async function(styleNumber = 'PC61') {
            spLog('🧪 Testing Screen Print API for:', styleNumber);
            try {
                const service = new ScreenPrintPricingService();
                const data = await service.fetchPricingData(styleNumber, { forceRefresh: true });
                spLog('✅ API Response:', data);
                return data;
            } catch (error) {
                console.error('❌ API Error:', error);
                return null;
            }
        },

        // Compare API vs Caspio prices
        compareCalculations: async function(qty = 48, colors = 2) {
            const calculator = window.screenPrintCalculator;
            if (!calculator) {
                console.error('Calculator not initialized');
                return;
            }

            const styleNumber = calculator.state.styleNumber || 'PC61';
            spLog(`📊 Comparing prices for ${styleNumber}, Qty: ${qty}, Colors: ${colors}`);

            // Get API pricing
            const apiData = await this.testAPI(styleNumber);
            if (apiData && apiData.primaryLocationPricing) {
                const apiPricing = apiData.primaryLocationPricing[colors.toString()];
                if (apiPricing && apiPricing.tiers) {
                    const tier = apiPricing.tiers.find(t => qty >= t.minQty && (!t.maxQty || qty <= t.maxQty));
                    if (tier) {
                        const apiPrice = tier.prices['M'] || tier.prices[Object.keys(tier.prices)[0]];
                        spLog(`API Price: $${apiPrice}`);
                    }
                }
            }

            // Get current calculator price
            calculator.state.quantity = qty;
            calculator.state.frontColors = colors;
            const pricing = calculator.calculatePricing();
            spLog(`Calculator Price: $${pricing.perShirtTotal.toFixed(2)}`);

            return { api: apiData, calculated: pricing };
        },

        // Check service status
        checkStatus: function() {
            const calculator = window.screenPrintCalculator;
            const service = calculator?.pricingService;

            if (service) {
                const status = service.getStatus();
                spLog('📊 Service Status:', status);
                spLog('API Mode: ✅ Enabled (Direct API Only)');
                spLog('Pricing Data Loaded:', calculator.state.pricingData ? '✅ Yes' : '❌ No');
            } else {
                spLog('❌ Service not initialized');
            }
        },

        // Clear cache
        clearCache: function() {
            const calculator = window.screenPrintCalculator;
            if (calculator?.pricingService) {
                calculator.pricingService.clearCache();
                spLog('🗑️ Cache cleared');
            } else {
                spLog('❌ Service not available');
            }
        },

        // Reload pricing data
        reload: async function() {
            const calculator = window.screenPrintCalculator;
            if (calculator && calculator.state.styleNumber) {
                await calculator.checkUrlParams();
                spLog('🔄 Pricing data reloaded');
            } else {
                spLog('❌ No style number to reload');
            }
        }
    };

    // Pricing Report Generator for Testing/Verification
    window.SCREENPRINT_DEBUG = {
        getPricingReport: function() {
            const calculator = window.screenPrintCalculator;
            if (!calculator) {
                console.error('❌ Calculator not initialized');
                return 'ERROR: Calculator not initialized';
            }

            const state = calculator.state;
            const pricing = calculator.calculatePricing();
            const pricingData = state.pricingData || state.masterBundle;

            // Build comprehensive report
            let report = '\n';
            report += '═══════════════════════════════════════════════════════════\n';
            report += '          SCREEN PRINT PRICING CALCULATION REPORT          \n';
            report += '═══════════════════════════════════════════════════════════\n\n';

            // Product Information
            report += '📦 PRODUCT DETAILS:\n';
            report += '─────────────────────────────────────────────────────────\n';
            report += `Style Number: ${state.styleNumber || 'Not set'}\n`;
            report += `Product Title: ${state.productTitle || 'Not set'}\n`;
            report += `Color: ${state.productColor || 'Not set'}\n`;
            report += `Garment Type: ${state.garmentType || 'Not set'}\n\n`;

            // Selection Details
            report += '🎨 SELECTIONS:\n';
            report += '─────────────────────────────────────────────────────────\n';
            report += `Quantity: ${state.quantity}\n`;
            report += `Front Colors: ${state.frontColors}\n`;
            report += `Back Colors: ${state.backColors}\n`;
            report += `Primary Location: ${state.primaryLocation || 'Front'}\n`;
            if (state.hasAdditionalLocations) {
                report += `Additional Locations: ${JSON.stringify(state.additionalLocations || [])}\n`;
            }
            report += `Safety Stripes: ${state.hasSafetyStripes ? 'Yes' : 'No'}\n\n`;

            // Base Pricing Data
            report += '💰 BASE PRICING DATA (from API):\n';
            report += '─────────────────────────────────────────────────────────\n';
            if (pricingData && pricingData.sizes) {
                const sizes = pricingData.sizes;
                const baseCost = Math.min(...sizes.map(s => s.price).filter(p => p > 0));
                report += `Garment Sizes Available: ${sizes.map(s => s.size).join(', ')}\n`;
                report += `Base Garment Cost (lowest): $${baseCost.toFixed(2)}\n`;
            }
            if (pricingData && pricingData.tiersR) {
                const currentTier = pricingData.tiersR.find(t =>
                    state.quantity >= t.MinQuantity && state.quantity <= t.MaxQuantity
                );
                if (currentTier) {
                    report += `Current Tier: ${currentTier.TierLabel}\n`;
                    report += `Margin Denominator: ${currentTier.MarginDenominator}\n`;
                    report += `LTM Fee: $${currentTier.LTM_Fee || 0}\n`;
                }
            }
            report += '\n';

            // Print Costs
            report += '🖨️ PRINT COSTS:\n';
            report += '─────────────────────────────────────────────────────────\n';
            if (pricing.frontPrintCost) {
                report += `Front Print (${state.frontColors} color${state.frontColors !== 1 ? 's' : ''}): $${pricing.frontPrintCost.toFixed(2)}\n`;
            }
            if (pricing.backPrintCost) {
                report += `Back Print (${state.backColors} color${state.backColors !== 1 ? 's' : ''}): $${pricing.backPrintCost.toFixed(2)}\n`;
            }
            if (pricing.additionalLocationsCost && pricing.additionalLocationsCost > 0) {
                report += `Additional Locations: $${pricing.additionalLocationsCost.toFixed(2)}\n`;
            }
            if (pricing.safetyStripesCost && pricing.safetyStripesCost > 0) {
                report += `Safety Stripes: $${pricing.safetyStripesCost.toFixed(2)}\n`;
            }
            report += '\n';

            // Calculation Breakdown - Enhanced with raw API values
            report += '🧮 CALCULATION BREAKDOWN:\n';
            report += '─────────────────────────────────────────────────────────\n';

            // Get debug data if available
            const debugData = pricingData?.debug || {};
            const currentTier = this.findTierForQuantity(state.quantity, pricingData?.tierData);

            if (currentTier) {
                const marginDenom = currentTier.MarginDenominator;
                const markupPercent = ((1 / marginDenom - 1) * 100).toFixed(0);
                report += `Quantity Tier: ${currentTier.TierLabel}\n`;
                report += `Margin Denominator: ${marginDenom}\n`;
                report += `Markup: ${markupPercent}%\n\n`;
            }

            // Garment calculation breakdown
            if (pricing.garmentCost !== undefined) {
                const baseGarmentCost = debugData.baseGarmentCost || 0;
                const marginDenom = currentTier?.MarginDenominator || 0.5;
                const beforeRounding = baseGarmentCost / marginDenom;

                report += 'GARMENT CALCULATION:\n';
                report += `  1. Base Cost (from API): $${baseGarmentCost.toFixed(2)}\n`;
                report += `  2. Apply Margin (÷ ${marginDenom}): $${beforeRounding.toFixed(2)}\n`;
                report += `  3. Round Up to $0.50: $${pricing.garmentCost.toFixed(2)}\n\n`;
            }

            // Print calculation breakdown
            if (pricing.frontPrintCost !== undefined && state.frontColors > 0) {
                // Find base print cost from debug data
                const basePrintEntry = debugData.basePrintCosts?.find(c =>
                    c.TierLabel === currentTier?.TierLabel &&
                    c.ColorCount === state.frontColors &&
                    c.CostType === 'PrimaryLocation'
                );

                const basePrintCost = basePrintEntry?.BasePrintCost || 0;
                // Flash charge is now PER COLOR (simplified - applied to all garments)
                const flashChargePerColor = debugData.flashCharge || 0;
                const flashChargeTotal = flashChargePerColor * state.frontColors;
                const totalCost = basePrintCost + flashChargeTotal;
                const marginDenom = currentTier?.MarginDenominator || 0.5;
                const beforeRounding = totalCost / marginDenom;

                report += `PRINT CALCULATION (Front ${state.frontColors} color${state.frontColors !== 1 ? 's' : ''}):\n`;
                report += `  1. Base Print Cost (from API): $${basePrintCost.toFixed(2)}\n`;
                report += `  2. Flash Charge ($${flashChargePerColor.toFixed(2)} × ${state.frontColors} colors): $${flashChargeTotal.toFixed(2)}\n`;
                report += `  3. Total Cost: $${totalCost.toFixed(2)}\n`;
                report += `  4. Apply Margin (÷ ${marginDenom}): $${beforeRounding.toFixed(2)}\n`;
                report += `  5. Round Up to $0.50: $${pricing.frontPrintCost.toFixed(2)}\n\n`;
            }

            report += `Rounding Method: ${debugData.roundingMethod || 'HalfDollarCeil_Final'} (always round UP)\n`;
            report += '\n';

            // Final Totals
            report += '💵 FINAL TOTALS:\n';
            report += '─────────────────────────────────────────────────────────\n';
            report += `Unit Price: $${pricing.perShirtTotal ? pricing.perShirtTotal.toFixed(2) : '0.00'}\n`;
            report += `Subtotal (${state.quantity} × $${pricing.perShirtTotal ? pricing.perShirtTotal.toFixed(2) : '0.00'}): $${pricing.subtotal ? pricing.subtotal.toFixed(2) : '0.00'}\n`;
            if (pricing.ltmFee && pricing.ltmFee > 0) {
                report += `LTM Fee: $${pricing.ltmFee.toFixed(2)}\n`;
            }
            report += `GRAND TOTAL: $${pricing.total ? pricing.total.toFixed(2) : '0.00'}\n`;
            report += '\n';

            // Pricing Tier Table (if available)
            if (pricingData && pricingData.tiersR) {
                report += '📊 PRICING TIERS (for reference):\n';
                report += '─────────────────────────────────────────────────────────\n';
                pricingData.tiersR.forEach(tier => {
                    const isCurrent = state.quantity >= tier.MinQuantity && state.quantity <= tier.MaxQuantity;
                    const marker = isCurrent ? '→ ' : '  ';
                    report += `${marker}${tier.TierLabel}: ${tier.MinQuantity}-${tier.MaxQuantity} qty, Margin: ${tier.MarginDenominator}\n`;
                });
                report += '\n';
            }

            report += '═══════════════════════════════════════════════════════════\n';
            report += '✅ Copy the above report to share with Claude for verification\n';
            report += '═══════════════════════════════════════════════════════════\n';

            spLog(report);
            return report;
        },

        // Helper method to find tier for quantity
        findTierForQuantity: function(quantity, tierData) {
            if (!tierData) return null;

            for (const tierLabel in tierData) {
                const tier = tierData[tierLabel];
                if (quantity >= tier.MinQuantity && quantity <= tier.MaxQuantity) {
                    return tier;
                }
            }
            return null;
        }
    };

    // Setup search functionality with API integration
    function setupSearch() {
        const searchInput = document.getElementById('styleSearch');
        const searchBtn = document.getElementById('searchBtn');
        const searchWrapper = document.querySelector('.search-wrapper');

        if (!searchInput || !searchBtn || !searchWrapper) {
            console.warn('Search elements not found');
            return;
        }

        // Create search results dropdown
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';
        searchWrapper.appendChild(resultsContainer);

        let searchTimeout = null;

        // Perform API search
        async function performAPISearch(query) {
            if (query.length < 2) {
                resultsContainer.classList.remove('active');
                return;
            }

            // Show loading state
            resultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Searching...</div>';
            resultsContainer.classList.add('active');

            try {
                // Search using the API endpoint
                const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`);

                if (!response.ok) {
                    throw new Error('Search failed');
                }

                const results = await response.json();

                if (results.length === 0) {
                    resultsContainer.innerHTML = '<div class="search-no-results">No products found</div>';
                } else {
                    // Build results HTML
                    let html = '';
                    results.slice(0, 10).forEach(result => {
                        html += `
                            <div class="search-result-item" data-style="${result.style || result.value}">
                                <div class="search-result-style">${result.style || result.value}</div>
                                <div class="search-result-desc">${result.label}</div>
                            </div>
                        `;
                    });
                    resultsContainer.innerHTML = html;

                    // Add click handlers to results
                    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const style = item.dataset.style;
                            window.location.href = `?StyleNumber=${style}`;
                        });
                    });
                }
            } catch (error) {
                console.error('Search error:', error);
                resultsContainer.innerHTML = '<div class="search-no-results">Search failed. Please try again.</div>';
            }
        }

        // Handle search input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Clear previous timeout
            clearTimeout(searchTimeout);

            if (query.length < 2) {
                resultsContainer.classList.remove('active');
                return;
            }

            // Debounce search
            searchTimeout = setTimeout(() => {
                performAPISearch(query);
            }, 300);
        });

        // Handle enter key for direct navigation
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = searchInput.value.trim();
                if (value) {
                    // Try direct style number navigation
                    window.location.href = `?StyleNumber=${value}`;
                }
            }
        });

        // Handle search button click
        searchBtn.addEventListener('click', () => {
            const value = searchInput.value.trim();
            if (value) {
                window.location.href = `?StyleNumber=${value}`;
            }
        });

        // Close results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchWrapper.contains(e.target)) {
                resultsContainer.classList.remove('active');
            }
        });

        spLog('✅ Search functionality initialized');
    }

    // Store calculator reference when initialized
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize search functionality
        setupSearch();

        setTimeout(() => {
            // Skip if manual mode already initialized calculator
            if (window.screenPrintManualMode) {
                spLog('[ScreenPrint Debug] Skipping third calculator initialization - manual mode active');
            } else if (typeof ScreenPrintPricing !== 'undefined') {
                window.screenPrintCalculator = new ScreenPrintPricing();
                spLog('═══════════════════════════════════════════════════════════');
                spLog('🚀 Screen Print Pricing System: Direct API Mode');
                spLog('═══════════════════════════════════════════════════════════');
                spLog('📦 API endpoint: /api/pricing-bundle?method=ScreenPrint');
                spLog('');
                spLog('🧪 Testing Commands:');
                spLog('  • SCREENPRINT_API_TEST.testAPI() - Test API endpoint');
                spLog('  • SCREENPRINT_API_TEST.checkStatus() - Check service status');
                spLog('  • SCREENPRINT_API_TEST.clearCache() - Clear price cache');
                spLog('');
                spLog('📋 Pricing Report:');
                spLog('  • SCREENPRINT_DEBUG.getPricingReport() - Get detailed pricing report');
                spLog('    (Select your options first, then run this to copy/paste results)');
                spLog('═══════════════════════════════════════════════════════════');
            }
        }, 100);
    });
})();
