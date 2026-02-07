/**
 * Additional Logo Pricing Table - Embroidery
 * Fetches pricing from EMB-AL API endpoint and populates simple pricing table
 * No complex calculator - just display the tier prices
 * Created: 2025-01-10
 */

(function() {
    'use strict';

    const API_BASE = window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const API_ENDPOINT = `${API_BASE}/api/pricing-bundle?method=EMB-AL`;

    // Fallback pricing (used only if API fails)
    // 2026-02: Updated to $112-120/hr target billing rate
    const FALLBACK_PRICING = {
        '1-7': 10.00,
        '8-23': 9.00,
        '24-47': 8.00,
        '48-71': 7.50,
        '72+': 7.00
    };

    const FALLBACK_CONFIG = {
        baseStitchCount: 8000,
        additionalStitchRate: 1.25
    };

    /**
     * Initialize the additional logo pricing table
     */
    async function initAdditionalLogoPricing() {

        try {
            // Fetch pricing from API
            const data = await fetchPricingFromAPI();

            // Populate table with API data
            populatePricingTable(data);


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
        // 2026-02 RESTRUCTURE: New tiers 1-7 and 8-23
        updateCell('emb-al-1-7', pricing['1-7']);
        updateCell('emb-al-8-23', pricing['8-23']);
        updateCell('emb-al-24-47', pricing['24-47']);
        updateCell('emb-al-48-71', pricing['48-71']);
        updateCell('emb-al-72', pricing['72+']);

        // Update note with stitch rate (if available)
        if (config && config.additionalStitchRate) {
            updateNoteWithStitchRate(config.baseStitchCount, config.additionalStitchRate);
        }

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
