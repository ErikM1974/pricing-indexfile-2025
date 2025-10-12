/**
 * Additional Logo Pricing Table - Embroidery
 * Fetches pricing from EMB-AL API endpoint and populates simple pricing table
 * No complex calculator - just display the tier prices
 * Created: 2025-01-10
 */

(function() {
    'use strict';

    const API_ENDPOINT = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=EMB-AL';

    // Fallback pricing (used only if API fails)
    const FALLBACK_PRICING = {
        '1-23': 12.50,
        '24-47': 11.50,
        '48-71': 9.50,
        '72+': 8.50
    };

    const FALLBACK_CONFIG = {
        baseStitchCount: 8000,
        additionalStitchRate: 1.25
    };

    /**
     * Initialize the additional logo pricing table
     */
    async function initAdditionalLogoPricing() {
        console.log('[AdditionalLogo-EMB-Simple] Initializing...');

        try {
            // Fetch pricing from API
            const data = await fetchPricingFromAPI();

            // Populate table with API data
            populatePricingTable(data);

            console.log('[AdditionalLogo-EMB-Simple] ✅ Initialized successfully');

        } catch (error) {
            console.error('[AdditionalLogo-EMB-Simple] ❌ Error:', error);

            // Show error message
            showErrorMessage();

            // Use fallback pricing
            populatePricingTable({
                pricing: FALLBACK_PRICING,
                config: FALLBACK_CONFIG
            });
        }
    }

    /**
     * Fetch pricing data from API
     */
    async function fetchPricingFromAPI() {
        console.log('[AdditionalLogo-EMB-Simple] Fetching from API:', API_ENDPOINT);

        const response = await fetch(API_ENDPOINT, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[AdditionalLogo-EMB-Simple] API data received:', data);

        // Extract pricing from allEmbroideryCostsR array
        const pricing = {};
        const config = {};

        if (data.allEmbroideryCostsR && Array.isArray(data.allEmbroideryCostsR)) {
            // Map each tier to its price
            data.allEmbroideryCostsR.forEach(tier => {
                const tierLabel = tier.TierLabel;
                const cost = parseFloat(tier.EmbroideryCost);

                pricing[tierLabel] = cost;

                // Store config from first tier
                if (!config.baseStitchCount) {
                    config.baseStitchCount = parseInt(tier.BaseStitchCount);
                    config.additionalStitchRate = parseFloat(tier.AdditionalStitchRate);
                }
            });

            console.log('[AdditionalLogo-EMB-Simple] Extracted pricing:', pricing);
            console.log('[AdditionalLogo-EMB-Simple] Config:', config);

            return { pricing, config };
        } else {
            throw new Error('Invalid API response structure');
        }
    }

    /**
     * Populate the pricing table with data
     */
    function populatePricingTable(data) {
        const { pricing, config } = data;

        // Update table cells
        updateCell('emb-al-1-23', pricing['1-23']);
        updateCell('emb-al-24-47', pricing['24-47']);
        updateCell('emb-al-48-71', pricing['48-71']);
        updateCell('emb-al-72', pricing['72+']);

        // Update note with stitch rate (if available)
        if (config && config.additionalStitchRate) {
            updateNoteWithStitchRate(config.baseStitchCount, config.additionalStitchRate);
        }

        console.log('[AdditionalLogo-EMB-Simple] ✅ Table populated');
    }

    /**
     * Update a single table cell
     */
    function updateCell(cellId, price) {
        const cell = document.getElementById(cellId);

        if (!cell) {
            console.warn(`[AdditionalLogo-EMB-Simple] ⚠️ Cell not found: ${cellId}`);
            return;
        }

        if (price !== undefined && price !== null) {
            cell.textContent = `$${price.toFixed(2)}`;
            cell.classList.remove('loading');
        } else {
            cell.textContent = 'N/A';
            cell.classList.add('loading');
        }
    }

    /**
     * Update the note section with stitch rate info
     */
    function updateNoteWithStitchRate(baseStitches, rate) {
        // Find the note paragraph that mentions stitch rate
        const notes = document.querySelector('.additional-logo-notes');

        if (notes) {
            const noteParagraph = notes.querySelector('p:first-child');
            if (noteParagraph) {
                noteParagraph.innerHTML = `<strong>Note:</strong> Additional logos up to ${baseStitches.toLocaleString()} stitches. Add $${rate.toFixed(2)} per 1,000 stitches over base.`;
            }
        }
    }

    /**
     * Show error message when API fails
     */
    function showErrorMessage() {
        const section = document.querySelector('.additional-logo-pricing-section');

        if (!section) return;

        // Check if error already exists
        if (section.querySelector('.additional-logo-error')) return;

        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'additional-logo-error';
        errorDiv.innerHTML = `
            <p>
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Note:</strong> Using cached pricing. Live pricing temporarily unavailable.
            </p>
        `;

        // Insert at the beginning of the section
        section.insertBefore(errorDiv, section.firstChild);
    }

    /**
     * Initialize when DOM is ready
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAdditionalLogoPricing);
        } else {
            // DOM already loaded
            initAdditionalLogoPricing();
        }
    }

    // Start initialization
    init();

    // Expose for debugging
    if (typeof window !== 'undefined') {
        window.AdditionalLogoEmbDebug = {
            refresh: initAdditionalLogoPricing,
            fetchAPI: fetchPricingFromAPI
        };
    }

})();
