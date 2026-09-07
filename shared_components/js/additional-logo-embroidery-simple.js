/**
 * Additional Logo Pricing Table - Embroidery
 * Fetches pricing from EMB-AL API endpoint and populates simple pricing table
 * No complex calculator - just display the tier prices
 * Created: 2025-01-10
 */

(function() {
    'use strict';

    const API_BASE = window.APP_CONFIG?.API?.BASE_URL || '';
    if (!API_BASE) console.error('[additional-logo-embroidery-simple] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
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


            // The tier list (Pricing_Tiers) drives the table's columns — never a typed 1-7…72+ layout (2026-09-06).
            const tiers = (Array.isArray(data.tiersR) ? data.tiersR : [])
                .filter(t => t && Number.isFinite(Number(t.MinQuantity)))
                .map(t => ({ label: t.TierLabel, min: Number(t.MinQuantity), max: Number(t.MaxQuantity), ltm: parseFloat(t.LTM_Fee) || 0 }))
                .sort((a, b) => a.min - b.min);

            return { pricing, config, tiers };
        } else {
            throw new Error('Invalid API response structure');
        }
    }

    /**
     * Populate the pricing table with data
     */
    function populatePricingTable(data) {
        const { pricing, config, tiers } = data;

        if (Array.isArray(tiers) && tiers.length) {
            renderTableFromTiers(tiers, pricing);
        } else {
            // API answered without a tier list (or the fallback pricing is in use): fill the static cells by label
            ['1-7', '8-23', '24-47', '48-71', '72+'].forEach(label => updateCell('emb-al-' + label.replace('72+', '72'), pricing[label]));
        }

        // Update note with stitch rate (if available)
        if (config && config.additionalStitchRate) {
            updateNoteWithStitchRate(config.baseStitchCount, config.additionalStitchRate);
        }

    }

    /**
     * Build the header row and the price row from the API tiers: one column per tier, the tier
     * carrying the LTM fee gets the ltm-column class, every cell keeps the emb-al-<TierLabel> id.
     */
    function renderTableFromTiers(tiers, pricing) {
        const table = document.querySelector('.additional-logo-table');
        if (!table) return;
        const thead = table.querySelector('thead');
        const firstTh = thead && thead.querySelector('th');
        const firstHeader = firstTh ? firstTh.textContent.trim() : 'Quantity';
        const rangeText = (t) => (t.max >= 99999 || /\+$/.test(String(t.label))) ? `${t.min}+ pieces` : `${t.min}-${t.max} pieces`;
        if (thead) {
            thead.innerHTML = '<tr><th>' + firstHeader + '</th>' + tiers.map(t =>
                `<th${t.ltm > 0 ? ' class="ltm-column"' : ''} data-tier="${t.label}">${rangeText(t)}</th>`).join('') + '</tr>';
        }
        const row = table.querySelector('tbody tr');
        if (!row) return;
        const labelCell = row.querySelector('td.tier-label');
        row.innerHTML = (labelCell ? labelCell.outerHTML : '<td class="tier-label">Base Price</td>') + tiers.map(t =>
            `<td id="emb-al-${t.label}" class="price-cell${t.ltm > 0 ? ' ltm-column' : ''} loading">Loading...</td>`).join('');
        tiers.forEach(t => updateCell('emb-al-' + t.label, pricing[t.label]));
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
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
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
