/**
 * Embroidery Pricing All - 3-Tab Unified Embroidery Pricing Page
 *
 * Tab 1: CONTRACT - Detailed stitch-based pricing for production/Ruthie
 *        Target: $100-$125/hour billing rate
 *        Customer supplies their own garments/caps
 *
 * Tab 2: AL RETAIL - Simplified tier-only pricing for sales reps
 *        Adding logos to garments/caps WE'RE selling
 *        No stitch counts displayed - just tier prices
 *
 * Tab 3: DECG RETAIL - Simplified pricing for customer-supplied items
 *        Retail pricing for sales reps
 *
 * Pricing effective February 2026
 * All pricing data fetched from Caspio via API
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// ============================================
// PRICING DATA (loaded from API)
// ============================================

let CONTRACT_PRICING = null;
let AL_RETAIL_PRICING = null;
let DECG_RETAIL_PRICING = null;
let CAP_UPGRADES = null;

// Production rates for hourly revenue calculation (static - not in Caspio)
const PRODUCTION_RATES = {
    garments: {
        5000: 19.1, 6000: 17.8, 7000: 16.7, 8000: 15.7,
        9000: 14.9, 10000: 14.1, 11000: 13.4, 12000: 12.7, 15000: 11.1
    },
    caps: {
        5000: 26.3, 6000: 24.5, 7000: 23.0, 8000: 21.6,
        9000: 20.4, 10000: 19.4, 11000: 18.5, 12000: 17.5, 15000: 15.2
    }
};

// ============================================
// TIER ORDERS
// ============================================

const TIER_ORDER = ['1-7', '8-23', '24-47', '48-71', '72+'];
const FB_STITCH_EXAMPLES = [25000, 30000, 35000, 50000];

// Stitch counts for full back pricing (25K minimum, higher range)
const FB_STITCH_COUNTS = [25000, 30000, 35000, 40000, 45000, 50000];

// Stitch counts for contract pricing matrices (5K to 25K)
const CONTRACT_STITCH_COUNTS = [
    5000, 6000, 7000, 8000, 9000, 10000,
    11000, 12000, 13000, 14000, 15000,
    16000, 17000, 18000, 19000, 20000,
    21000, 22000, 23000, 24000, 25000
];

// Get stitch counts for contract pricing display
function getContractStitchCounts() {
    return CONTRACT_STITCH_COUNTS;
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Show loading state
    showLoadingState();

    try {
        // Load all pricing data from API in parallel
        await loadAllPricingData();

        // Fetch cap upgrades pricing
        await fetchCapUpgrades();

        // Build all matrices
        buildContractGarmentsMatrix();
        buildContractCapsMatrix();
        buildContractFullBackMatrix();
        buildAlRetailGarmentsMatrix();
        buildAlRetailCapsMatrix();
        buildAlRetailFullBackMatrix();
        buildDecgRetailGarmentsMatrix();
        buildDecgRetailCapsMatrix();
        buildDecgRetailFullBackMatrix();

        // Build cap upgrades cards
        buildCapUpgradesCard('contractCapUpgrades');
        buildCapUpgradesCard('alRetailCapUpgrades');
        buildCapUpgradesCard('decgRetailCapUpgrades');

        // Setup calculators
        setupContractCalculator();
        setupAlRetailCalculator();
        setupDecgRetailCalculator();

        // Hide loading state
        hideLoadingState();

    } catch (error) {
        console.error('Failed to load pricing data:', error);
        showErrorState('Unable to load pricing data. Please refresh the page.');
    }

    // Auto-select tab from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['contract', 'al-retail', 'stitch-charges', 'decg-retail'].includes(tabParam)) {
        switchTab(tabParam);
    }
});

// ============================================
// API LOADING FUNCTIONS
// ============================================

async function loadAllPricingData() {
    const [contractData, alData, decgData] = await Promise.all([
        fetchContractPricing(),
        fetchAlPricing(),
        fetchDecgPricing()
    ]);

    CONTRACT_PRICING = contractData;
    AL_RETAIL_PRICING = alData;
    DECG_RETAIL_PRICING = decgData;

}

async function fetchContractPricing() {
    const response = await fetch(`${API_BASE_URL}/api/contract-pricing`);
    if (!response.ok) {
        throw new Error(`Contract pricing API error: ${response.status}`);
    }
    const data = await response.json();

    // Transform API response to match expected structure
    return {
        garments: data.garments,
        caps: data.caps,
        fullBack: {
            perThousandRates: data.fullBack.perThousandRates,
            minStitches: data.fullBack.minStitches || 25000,
            minPrice: data.fullBack.minPrice || 20.00,
            ltmFee: data.ltmFee || 50,
            ltmThreshold: data.ltmThreshold || 23
        },
        ltmFee: data.ltmFee || 50,
        ltmThreshold: data.ltmThreshold || 23
    };
}

async function fetchAlPricing() {
    const response = await fetch(`${API_BASE_URL}/api/al-pricing`);
    if (!response.ok) {
        throw new Error(`AL pricing API error: ${response.status}`);
    }
    const data = await response.json();

    // Transform API response to match expected structure
    return {
        garments: {
            basePrices: data.garments.basePrices,
            baseStitches: data.garments.baseStitches || 8000,
            perThousandUpcharge: data.garments.perThousandUpcharge || 1.25,
            ltmFee: data.garments.ltmFee || 50,
            ltmThreshold: data.garments.ltmThreshold || 7
        },
        caps: {
            basePrices: data.caps.basePrices,
            baseStitches: data.caps.baseStitches || 5000,
            perThousandUpcharge: data.caps.perThousandUpcharge || 1.00,
            ltmFee: data.caps.ltmFee || 50,
            ltmThreshold: data.caps.ltmThreshold || 7
        }
    };
}

async function fetchDecgPricing() {
    const response = await fetch(`${API_BASE_URL}/api/decg-pricing`);
    if (!response.ok) {
        throw new Error(`DECG pricing API error: ${response.status}`);
    }
    const data = await response.json();

    // Transform API response to match expected structure
    return {
        garments: {
            basePrices: data.garments.basePrices,
            baseStitches: 8000,
            perThousandUpcharge: data.garments.perThousandUpcharge || 1.25,
            ltmFee: data.garments.ltmFee || 50,
            ltmThreshold: data.garments.ltmThreshold || 7
        },
        caps: {
            basePrices: data.caps.basePrices,
            baseStitches: 8000,
            perThousandUpcharge: data.caps.perThousandUpcharge || 1.00,
            ltmFee: data.caps.ltmFee || 50,
            ltmThreshold: data.caps.ltmThreshold || 7
        },
        heavyweightSurcharge: data.heavyweightSurcharge || 10.00
    };
}

// Fetch cap upgrades (3D-Puff and Laser Patch)
async function fetchCapUpgrades() {
    try {
        const [puffResponse, patchResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/embroidery-costs?itemType=3D-Puff&stitchCount=0`),
            fetch(`${API_BASE_URL}/api/embroidery-costs?itemType=Patch&stitchCount=0`)
        ]);

        if (!puffResponse.ok || !patchResponse.ok) {
            throw new Error('Cap upgrades API error');
        }

        const puffData = await puffResponse.json();
        const patchData = await patchResponse.json();

        CAP_UPGRADES = {
            puff: {
                name: '3D Puff Embroidery',
                partNumber: '3D-EMB',
                price: puffData[0]?.EmbroideryCost || 5.00
            },
            patch: {
                name: 'Laser Faux Leather Patch',
                partNumber: 'Laser Patch',
                price: patchData[0]?.EmbroideryCost || 5.00
            }
        };

        return CAP_UPGRADES;
    } catch (error) {
        console.error('Failed to fetch cap upgrades:', error);
        // Fallback to default values but warn the user
        CAP_UPGRADES = {
            puff: { name: '3D Puff Embroidery', partNumber: '3D-EMB', price: 5.00 },
            patch: { name: 'Laser Faux Leather Patch', partNumber: 'Laser Patch', price: 5.00 }
        };
        // Show visible warning — using fallback pricing
        const warningEl = document.getElementById('api-warning') || document.createElement('div');
        if (!warningEl.id) {
            warningEl.id = 'api-warning';
            warningEl.style.cssText = 'background:#fff3cd;color:#856404;border:1px solid #ffc107;padding:8px 12px;margin:8px 0;border-radius:4px;font-size:13px;';
            const container = document.querySelector('.calculator-container') || document.body;
            container.prepend(warningEl);
        }
        warningEl.textContent = 'Cap upgrade pricing may be approximate — API unavailable. Refresh to retry.';
        warningEl.style.display = 'block';
        return CAP_UPGRADES;
    }
}

// Build cap upgrades content (in ShopWorks reference card)
function buildCapUpgradesCard(cardId) {
    const container = document.getElementById(cardId);
    if (!container || !CAP_UPGRADES) return;

    container.innerHTML = `
        <span class="upgrade-item">
            <span class="ref-code">${CAP_UPGRADES.puff.partNumber}</span>
            3D Puff
            <span class="upgrade-price">+$${CAP_UPGRADES.puff.price.toFixed(2)}</span>
        </span>
        <span class="upgrade-item">
            <span class="ref-code">${CAP_UPGRADES.patch.partNumber}</span>
            Patch
            <span class="upgrade-price">+$${CAP_UPGRADES.patch.price.toFixed(2)}</span>
        </span>
    `;
}

function showLoadingState() {
    document.querySelectorAll('.pricing-matrix tbody').forEach(tbody => {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading pricing data...</td></tr>';
    });
}

function hideLoadingState() {
    // Loading state is replaced when matrices are built
}

function showErrorState(message) {
    const errorHtml = `<tr><td colspan="6" class="error-cell">${message}</td></tr>`;
    document.querySelectorAll('.pricing-matrix tbody').forEach(tbody => {
        tbody.innerHTML = errorHtml;
    });
}

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url);
}

// Make switchTab globally available
window.switchTab = switchTab;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatPrice(price) {
    return '$' + price.toFixed(2);
}

function getTierFromQuantity(qty) {
    if (qty <= 7) return '1-7';
    if (qty <= 23) return '8-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
}

function getAlRetailTierFromQuantity(qty) {
    // Now uses 5 tiers matching DECG structure
    if (qty <= 7) return '1-7';
    if (qty <= 23) return '8-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
}

function getClosestStitchCount(stitches, itemType = 'garment') {
    // Get available stitch counts from PRODUCTION_RATES (for hourly revenue calculation)
    const available = itemType === 'cap'
        ? Object.keys(PRODUCTION_RATES.caps).map(k => parseInt(k)).sort((a, b) => a - b)
        : Object.keys(PRODUCTION_RATES.garments).map(k => parseInt(k)).sort((a, b) => a - b);

    // Find the closest stitch count that's >= input, or the max if over
    for (const count of available) {
        if (stitches <= count) return count;
    }
    return available[available.length - 1];
}

/**
 * Calculate unit price with LTM fee built into the per-piece price
 * @param {number} baseUnitPrice - The base unit price before LTM
 * @param {number} quantity - Number of pieces
 * @param {number} ltmThreshold - Quantity at or below which LTM applies
 * @param {number} ltmFee - The LTM fee amount
 * @returns {object} { finalUnitPrice, ltmPerPiece, hasLtm }
 */
function calculateUnitPriceWithLTM(baseUnitPrice, quantity, ltmThreshold, ltmFee) {
    if (quantity > 0 && quantity <= ltmThreshold) {
        const ltmPerPiece = ltmFee / quantity;
        return {
            finalUnitPrice: baseUnitPrice + ltmPerPiece,
            ltmPerPiece: ltmPerPiece,
            hasLtm: true
        };
    }
    return {
        finalUnitPrice: baseUnitPrice,
        ltmPerPiece: 0,
        hasLtm: false
    };
}

// ============================================
// CONTRACT MATRICES
// ============================================

function buildContractGarmentsMatrix() {
    const tbody = document.querySelector('#contractGarmentsMatrix tbody');
    if (!tbody) return;

    if (!CONTRACT_PRICING || !CONTRACT_PRICING.garments || !CONTRACT_PRICING.garments.perThousandRates) {
        tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Contract pricing not available</td></tr>';
        return;
    }

    const stitchCounts = getContractStitchCounts();
    const rates = CONTRACT_PRICING.garments.perThousandRates;
    let html = '';

    stitchCounts.forEach(stitches => {
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const rate = rates[tier];
            const price = (stitches / 1000) * rate;
            // LTM applies to first two tiers (1-7 and 8-23)
            const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Add footer row with per-thousand rates
    html += '<tr class="rate-footer">';
    html += '<td><strong>$/1K</strong></td>';
    TIER_ORDER.forEach((tier, idx) => {
        const rate = rates[tier];
        // LTM applies to first two tiers (1-7 and 8-23)
        const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
        html += `<td class="${cellClass}"><strong>${formatPrice(rate)}</strong></td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

function buildContractCapsMatrix() {
    const tbody = document.querySelector('#contractCapsMatrix tbody');
    if (!tbody) return;

    if (!CONTRACT_PRICING || !CONTRACT_PRICING.caps || !CONTRACT_PRICING.caps.perThousandRates) {
        tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Contract pricing not available</td></tr>';
        return;
    }

    const stitchCounts = getContractStitchCounts();
    const rates = CONTRACT_PRICING.caps.perThousandRates;
    let html = '';

    stitchCounts.forEach(stitches => {
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const rate = rates[tier];
            const price = (stitches / 1000) * rate;
            // LTM applies to first two tiers (1-7 and 8-23)
            const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Add footer row with per-thousand rates
    html += '<tr class="rate-footer">';
    html += '<td><strong>$/1K</strong></td>';
    TIER_ORDER.forEach((tier, idx) => {
        const rate = rates[tier];
        // LTM applies to first two tiers (1-7 and 8-23)
        const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
        html += `<td class="${cellClass}"><strong>${formatPrice(rate)}</strong></td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

function buildContractFullBackMatrix() {
    const tbody = document.querySelector('#contractFullBackMatrix tbody');
    if (!tbody) return;

    if (!CONTRACT_PRICING || !CONTRACT_PRICING.fullBack || !CONTRACT_PRICING.fullBack.perThousandRates) {
        tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Full back pricing not available</td></tr>';
        return;
    }

    const rates = CONTRACT_PRICING.fullBack.perThousandRates;
    const minPrice = CONTRACT_PRICING.fullBack.minPrice || 20.00;
    let html = '';

    // Build rows for each stitch count (like Garments/Caps)
    FB_STITCH_COUNTS.forEach(stitches => {
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const rate = rates[tier];
            const stitchesK = stitches / 1000;
            const price = Math.max(stitchesK * rate, minPrice);
            // LTM applies to first two tiers (1-7 and 8-23)
            const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Add footer row with per-thousand rates
    html += '<tr class="rate-footer">';
    html += '<td><strong>$/1K</strong></td>';
    TIER_ORDER.forEach((tier, idx) => {
        const rate = rates[tier];
        const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
        html += `<td class="${cellClass}"><strong>${formatPrice(rate)}</strong></td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

// ============================================
// AL RETAIL MATRICES (Simplified)
// ============================================

function buildAlRetailGarmentsMatrix() {
    const tbody = document.querySelector('#alRetailGarmentsMatrix tbody');
    if (!tbody) return;

    if (!AL_RETAIL_PRICING || !AL_RETAIL_PRICING.garments || !AL_RETAIL_PRICING.garments.basePrices) {
        tbody.innerHTML = '<tr><td colspan="2" class="error-cell">AL pricing not available</td></tr>';
        return;
    }

    // 5 tiers matching DECG structure for UI consistency
    const tiers = [
        { label: '1-7 pcs', key: '1-7', note: '+$50 LTM' },
        { label: '8-23 pcs', key: '8-23', note: '' },
        { label: '24-47 pcs', key: '24-47', note: '' },
        { label: '48-71 pcs', key: '48-71', note: '' },
        { label: '72+ pcs', key: '72+', note: '' }
    ];

    let html = '';
    tiers.forEach(tier => {
        const price = AL_RETAIL_PRICING.garments.basePrices[tier.key];
        if (price === undefined) return;
        html += '<tr>';
        html += `<td>${tier.label}${tier.note ? ' <span class="ltm-badge-small">' + tier.note + '</span>' : ''}</td>`;
        html += `<td class="price-cell">${formatPrice(price)} each</td>`;
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildAlRetailCapsMatrix() {
    const tbody = document.querySelector('#alRetailCapsMatrix tbody');
    if (!tbody) return;

    if (!AL_RETAIL_PRICING || !AL_RETAIL_PRICING.caps || !AL_RETAIL_PRICING.caps.basePrices) {
        tbody.innerHTML = '<tr><td colspan="2" class="error-cell">AL cap pricing not available</td></tr>';
        return;
    }

    // 5 tiers matching DECG structure for UI consistency
    const tiers = [
        { label: '1-7 pcs', key: '1-7', note: '+$50 LTM' },
        { label: '8-23 pcs', key: '8-23', note: '' },
        { label: '24-47 pcs', key: '24-47', note: '' },
        { label: '48-71 pcs', key: '48-71', note: '' },
        { label: '72+ pcs', key: '72+', note: '' }
    ];

    let html = '';
    tiers.forEach(tier => {
        const price = AL_RETAIL_PRICING.caps.basePrices[tier.key];
        if (price === undefined) return;
        html += '<tr>';
        html += `<td>${tier.label}${tier.note ? ' <span class="ltm-badge-small">' + tier.note + '</span>' : ''}</td>`;
        html += `<td class="price-cell">${formatPrice(price)} each</td>`;
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildAlRetailFullBackMatrix() {
    const tbody = document.querySelector('#alRetailFullBackMatrix tbody');
    if (!tbody) return;

    // Use CONTRACT_PRICING since AL Full Back uses same pricing (DECG-FB)
    if (!CONTRACT_PRICING || !CONTRACT_PRICING.fullBack || !CONTRACT_PRICING.fullBack.perThousandRates) {
        tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Full back pricing not available</td></tr>';
        return;
    }

    const rates = CONTRACT_PRICING.fullBack.perThousandRates;
    const minPrice = CONTRACT_PRICING.fullBack.minPrice || 20.00;
    let html = '';

    FB_STITCH_COUNTS.forEach(stitches => {
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const rate = rates[tier];
            const stitchesK = stitches / 1000;
            const price = Math.max(stitchesK * rate, minPrice);
            const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Footer row with per-thousand rates
    html += '<tr class="rate-footer">';
    html += '<td><strong>$/1K</strong></td>';
    TIER_ORDER.forEach((tier, idx) => {
        const rate = rates[tier];
        const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
        html += `<td class="${cellClass}"><strong>${formatPrice(rate)}</strong></td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

// ============================================
// DECG RETAIL MATRICES (Simplified)
// ============================================

function buildDecgRetailGarmentsMatrix() {
    const tbody = document.querySelector('#decgRetailGarmentsMatrix tbody');
    if (!tbody) return;

    if (!DECG_RETAIL_PRICING || !DECG_RETAIL_PRICING.garments || !DECG_RETAIL_PRICING.garments.basePrices) {
        tbody.innerHTML = '<tr><td colspan="2" class="error-cell">DECG pricing not available</td></tr>';
        return;
    }

    const tiers = [
        { label: '1-7 pcs', key: '1-7', note: '+$50 LTM' },
        { label: '8-23 pcs', key: '8-23', note: '' },
        { label: '24-47 pcs', key: '24-47', note: '' },
        { label: '48-71 pcs', key: '48-71', note: '' },
        { label: '72+ pcs', key: '72+', note: '' }
    ];

    let html = '';
    tiers.forEach(tier => {
        const price = DECG_RETAIL_PRICING.garments.basePrices[tier.key];
        if (price === undefined) return;
        html += '<tr>';
        html += `<td>${tier.label}${tier.note ? ' <span class="ltm-badge-small">' + tier.note + '</span>' : ''}</td>`;
        html += `<td class="price-cell">${formatPrice(price)} each</td>`;
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildDecgRetailCapsMatrix() {
    const tbody = document.querySelector('#decgRetailCapsMatrix tbody');
    if (!tbody) return;

    if (!DECG_RETAIL_PRICING || !DECG_RETAIL_PRICING.caps || !DECG_RETAIL_PRICING.caps.basePrices) {
        tbody.innerHTML = '<tr><td colspan="2" class="error-cell">DECG cap pricing not available</td></tr>';
        return;
    }

    const tiers = [
        { label: '1-7 pcs', key: '1-7', note: '+$50 LTM' },
        { label: '8-23 pcs', key: '8-23', note: '' },
        { label: '24-47 pcs', key: '24-47', note: '' },
        { label: '48-71 pcs', key: '48-71', note: '' },
        { label: '72+ pcs', key: '72+', note: '' }
    ];

    let html = '';
    tiers.forEach(tier => {
        const price = DECG_RETAIL_PRICING.caps.basePrices[tier.key];
        if (price === undefined) return;
        html += '<tr>';
        html += `<td>${tier.label}${tier.note ? ' <span class="ltm-badge-small">' + tier.note + '</span>' : ''}</td>`;
        html += `<td class="price-cell">${formatPrice(price)} each</td>`;
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildDecgRetailFullBackMatrix() {
    const tbody = document.querySelector('#decgRetailFullBackMatrix tbody');
    if (!tbody) return;

    // Use CONTRACT_PRICING since DECG Full Back uses same pricing (DECG-FB)
    if (!CONTRACT_PRICING || !CONTRACT_PRICING.fullBack || !CONTRACT_PRICING.fullBack.perThousandRates) {
        tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Full back pricing not available</td></tr>';
        return;
    }

    const rates = CONTRACT_PRICING.fullBack.perThousandRates;
    const minPrice = CONTRACT_PRICING.fullBack.minPrice || 20.00;
    let html = '';

    FB_STITCH_COUNTS.forEach(stitches => {
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const rate = rates[tier];
            const stitchesK = stitches / 1000;
            const price = Math.max(stitchesK * rate, minPrice);
            const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Footer row with per-thousand rates
    html += '<tr class="rate-footer">';
    html += '<td><strong>$/1K</strong></td>';
    TIER_ORDER.forEach((tier, idx) => {
        const rate = rates[tier];
        const cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
        html += `<td class="${cellClass}"><strong>${formatPrice(rate)}</strong></td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

// ============================================
// CONTRACT CALCULATOR
// ============================================

function setupContractCalculator() {
    const itemTypeEl = document.getElementById('contractItemType');
    const quantityEl = document.getElementById('contractQuantity');
    const stitchesEl = document.getElementById('contractStitches');

    if (!itemTypeEl || !quantityEl || !stitchesEl) return;

    const updateCalc = () => calculateContractPrice();

    itemTypeEl.addEventListener('change', updateCalc);
    quantityEl.addEventListener('input', updateCalc);
    stitchesEl.addEventListener('input', updateCalc);

    // Initial calculation
    updateCalc();
}

function calculateContractPrice() {
    if (!CONTRACT_PRICING) {
        console.error('Contract pricing not loaded');
        return;
    }

    const itemType = document.getElementById('contractItemType').value;
    const quantity = parseInt(document.getElementById('contractQuantity').value) || 0;
    const stitches = parseInt(document.getElementById('contractStitches').value) || 8000;

    // Elements (new simplified structure)
    const stitchesGroup = document.getElementById('contractStitches').closest('.form-group');
    const breakdownRow = document.getElementById('contractBreakdownRow');
    const breakdownLabel = document.getElementById('contractBreakdownLabel');
    const breakdownValue = document.getElementById('contractBreakdownValue');
    const ltmBreakdownRow = document.getElementById('contractLtmBreakdownRow');
    const ltmBreakdownLabel = document.getElementById('contractLtmBreakdownLabel');
    const ltmBreakdownValue = document.getElementById('contractLtmBreakdownValue');
    const finalUnitPriceEl = document.getElementById('contractFinalUnitPrice');

    const tier = getTierFromQuantity(quantity);
    const ltmThreshold = CONTRACT_PRICING.ltmThreshold || 23;
    const ltmFeeAmount = CONTRACT_PRICING.ltmFee || 50;

    // Hide stitch count for laser patch
    if (itemType === 'laser-patch') {
        stitchesGroup.classList.add('hidden');
    } else {
        stitchesGroup.classList.remove('hidden');
    }

    // ---- LASER PATCH CALCULATION ----
    if (itemType === 'laser-patch') {
        // Laser patch uses cap 8K price + $5, rounded up to nearest $0.50
        const capRate = CONTRACT_PRICING.caps.perThousandRates[tier];
        const cap8kPrice = capRate * 8; // 8K stitches
        const patchUpcharge = 5.00;
        const rawPrice = cap8kPrice + patchUpcharge;
        const laserPatchPrice = Math.ceil(rawPrice * 2) / 2; // Round up to nearest $0.50

        // Show breakdown
        if (quantity > 0) {
            breakdownRow.classList.remove('hidden');
            breakdownLabel.textContent = `Laser Patch:`;
            breakdownValue.textContent = formatPrice(laserPatchPrice);
        } else {
            breakdownRow.classList.add('hidden');
        }

        // UNIFIED LTM: Laser patches use ≤7 threshold (matches AL and DECG tabs)
        const laserLtmThreshold = 7;
        const ltmResult = calculateUnitPriceWithLTM(laserPatchPrice, quantity, laserLtmThreshold, ltmFeeAmount);

        if (ltmResult.hasLtm && quantity > 0) {
            ltmBreakdownRow.classList.remove('hidden');
            ltmBreakdownLabel.textContent = `+ LTM ($${ltmFeeAmount} ÷ ${quantity}):`;
            ltmBreakdownValue.textContent = '+' + formatPrice(ltmResult.ltmPerPiece);
        } else {
            ltmBreakdownRow.classList.add('hidden');
        }

        finalUnitPriceEl.textContent = formatPrice(ltmResult.finalUnitPrice);
        return;
    }

    // ---- GARMENT/CAP CALCULATION ----
    let baseUnitPrice = 0;
    let rate = 0;

    if (itemType === 'garment') {
        rate = CONTRACT_PRICING.garments.perThousandRates[tier];
    } else if (itemType === 'cap') {
        rate = CONTRACT_PRICING.caps.perThousandRates[tier];
    }

    const stitchesK = stitches / 1000;
    baseUnitPrice = stitchesK * rate;

    // Show breakdown: "8K × $0.625/1K = $5.00"
    breakdownLabel.textContent = `${stitchesK}K × ${formatPrice(rate)}/1K:`;
    breakdownValue.textContent = formatPrice(baseUnitPrice);

    if (quantity > 0) {
        breakdownRow.classList.remove('hidden');
    } else {
        breakdownRow.classList.add('hidden');
    }

    // Calculate final price with LTM built in
    const ltmResult = calculateUnitPriceWithLTM(baseUnitPrice, quantity, ltmThreshold, ltmFeeAmount);

    // Show LTM breakdown if applicable: "+ LTM ($50 ÷ 3) = +$16.67"
    if (ltmResult.hasLtm && quantity > 0) {
        ltmBreakdownRow.classList.remove('hidden');
        ltmBreakdownLabel.textContent = `+ LTM ($${ltmFeeAmount} ÷ ${quantity}):`;
        ltmBreakdownValue.textContent = '+' + formatPrice(ltmResult.ltmPerPiece);
    } else {
        ltmBreakdownRow.classList.add('hidden');
    }

    // Final unit price (emphasized)
    finalUnitPriceEl.textContent = formatPrice(ltmResult.finalUnitPrice);
}

// ============================================
// AL RETAIL CALCULATOR
// ============================================

function setupAlRetailCalculator() {
    const itemTypeEl = document.getElementById('alRetailItemType');
    const quantityEl = document.getElementById('alRetailQuantity');
    const stitchesEl = document.getElementById('alRetailStitches');

    if (!itemTypeEl || !quantityEl || !stitchesEl) return;

    const updateCalc = () => calculateAlRetailPrice();

    itemTypeEl.addEventListener('change', updateCalc);
    quantityEl.addEventListener('input', updateCalc);
    stitchesEl.addEventListener('input', updateCalc);

    // Initial calculation
    updateCalc();
}

function calculateAlRetailPrice() {
    if (!AL_RETAIL_PRICING) {
        console.error('AL pricing not loaded');
        return;
    }

    const itemType = document.getElementById('alRetailItemType').value;
    const quantity = parseInt(document.getElementById('alRetailQuantity').value) || 0;
    const stitches = parseInt(document.getElementById('alRetailStitches').value) || 8000;

    // Elements
    const stitchesGroup = document.getElementById('alRetailStitches').closest('.form-group');
    const breakdownRow = document.getElementById('alRetailBreakdownRow');
    const breakdownLabel = document.getElementById('alRetailBreakdownLabel');
    const breakdownValue = document.getElementById('alRetailBreakdownValue');
    const extraStitchRow = document.getElementById('alRetailExtraStitchRow');
    const extraStitchLabel = document.getElementById('alRetailExtraStitchLabel');
    const extraStitchValue = document.getElementById('alRetailExtraStitchValue');
    const ltmBreakdownRow = document.getElementById('alRetailLtmBreakdownRow');
    const ltmBreakdownLabel = document.getElementById('alRetailLtmBreakdownLabel');
    const ltmBreakdownValue = document.getElementById('alRetailLtmBreakdownValue');
    const finalUnitPriceEl = document.getElementById('alRetailFinalUnitPrice');

    const tier = getAlRetailTierFromQuantity(quantity);

    // Hide stitch count for laser patch
    if (itemType === 'laser-patch') {
        stitchesGroup.classList.add('hidden');
    } else {
        stitchesGroup.classList.remove('hidden');
    }

    // LTM threshold for AL/DECG is 7 pieces
    const ltmThreshold = AL_RETAIL_PRICING.caps.ltmThreshold || 7;
    const ltmFeeAmount = AL_RETAIL_PRICING.caps.ltmFee || 50;

    // ---- LASER PATCH CALCULATION ----
    if (itemType === 'laser-patch') {
        // Use CONTRACT pricing for cap 8K rate + $5, rounded up to nearest $0.50
        // This ensures consistent laser patch pricing across all tabs
        const capRate = CONTRACT_PRICING.caps.perThousandRates[tier];
        const cap8kPrice = capRate * 8; // 8K stitches
        const patchUpcharge = 5.00;
        const rawPrice = cap8kPrice + patchUpcharge;
        const laserPatchPrice = Math.ceil(rawPrice * 2) / 2; // Round up to nearest $0.50

        // Show breakdown
        if (quantity > 0) {
            breakdownRow.classList.remove('hidden');
            breakdownLabel.textContent = `Laser Patch:`;
            breakdownValue.textContent = formatPrice(laserPatchPrice);
        } else {
            breakdownRow.classList.add('hidden');
        }

        // Hide extra stitch row (not applicable)
        extraStitchRow.classList.add('hidden');

        // Calculate LTM (uses AL threshold: 7)
        const ltmResult = calculateUnitPriceWithLTM(laserPatchPrice, quantity, ltmThreshold, ltmFeeAmount);

        if (ltmResult.hasLtm && quantity > 0) {
            ltmBreakdownRow.classList.remove('hidden');
            ltmBreakdownLabel.textContent = `+ LTM ($${ltmFeeAmount} ÷ ${quantity}):`;
            ltmBreakdownValue.textContent = '+' + formatPrice(ltmResult.ltmPerPiece);
        } else {
            ltmBreakdownRow.classList.add('hidden');
        }

        finalUnitPriceEl.textContent = formatPrice(ltmResult.finalUnitPrice);
        return;
    }

    // ---- GARMENT/CAP CALCULATION ----
    let pricing, baseStitches, perThousandUpcharge;

    if (itemType === 'garment') {
        pricing = AL_RETAIL_PRICING.garments;
    } else {
        pricing = AL_RETAIL_PRICING.caps;
    }

    const basePrice = pricing.basePrices[tier] || 0;
    baseStitches = pricing.baseStitches || 8000;
    perThousandUpcharge = pricing.perThousandUpcharge || 1.25;
    const itemLtmThreshold = pricing.ltmThreshold || 7;
    const itemLtmFeeAmount = pricing.ltmFee || 50;

    // Calculate extra stitch charge
    const extraK = Math.max(0, (stitches - baseStitches) / 1000);
    const extraCharge = extraK * perThousandUpcharge;
    const baseUnitPrice = basePrice + extraCharge;

    // Show breakdown
    if (quantity > 0) {
        breakdownRow.classList.remove('hidden');
        breakdownLabel.textContent = `Base (${baseStitches / 1000}K):`;
        breakdownValue.textContent = formatPrice(basePrice);

        if (extraK > 0) {
            extraStitchRow.classList.remove('hidden');
            extraStitchLabel.textContent = `+${extraK.toFixed(0)}K extra:`;
            extraStitchValue.textContent = '+' + formatPrice(extraCharge);
        } else {
            extraStitchRow.classList.add('hidden');
        }
    } else {
        breakdownRow.classList.add('hidden');
        extraStitchRow.classList.add('hidden');
    }

    // Calculate final price with LTM built in
    const ltmResult = calculateUnitPriceWithLTM(baseUnitPrice, quantity, itemLtmThreshold, itemLtmFeeAmount);

    // Show LTM breakdown if applicable
    if (ltmResult.hasLtm && quantity > 0) {
        ltmBreakdownRow.classList.remove('hidden');
        ltmBreakdownLabel.textContent = `+ LTM ($${itemLtmFeeAmount} ÷ ${quantity}):`;
        ltmBreakdownValue.textContent = '+' + formatPrice(ltmResult.ltmPerPiece);
    } else {
        ltmBreakdownRow.classList.add('hidden');
    }

    // Final unit price (emphasized)
    finalUnitPriceEl.textContent = formatPrice(ltmResult.finalUnitPrice);
}

// ============================================
// DECG RETAIL CALCULATOR
// ============================================

function setupDecgRetailCalculator() {
    const itemTypeEl = document.getElementById('decgRetailItemType');
    const quantityEl = document.getElementById('decgRetailQuantity');
    const stitchesEl = document.getElementById('decgRetailStitches');
    const heavyweightEl = document.getElementById('decgRetailHeavyweight');

    if (!itemTypeEl || !quantityEl || !stitchesEl || !heavyweightEl) return;

    const updateCalc = () => calculateDecgRetailPrice();

    itemTypeEl.addEventListener('change', updateCalc);
    quantityEl.addEventListener('input', updateCalc);
    stitchesEl.addEventListener('input', updateCalc);
    heavyweightEl.addEventListener('change', updateCalc);

    // Initial calculation
    updateCalc();
}

function calculateDecgRetailPrice() {
    if (!DECG_RETAIL_PRICING) {
        console.error('DECG pricing not loaded');
        return;
    }

    const itemType = document.getElementById('decgRetailItemType').value;
    const quantity = parseInt(document.getElementById('decgRetailQuantity').value) || 0;
    const stitches = parseInt(document.getElementById('decgRetailStitches').value) || 8000;
    const isHeavyweight = document.getElementById('decgRetailHeavyweight').checked;

    // Elements (new simplified structure)
    const stitchesGroup = document.getElementById('decgRetailStitches').closest('.form-group');
    const heavyweightGroup = document.getElementById('decgRetailHeavyweight').closest('.form-group');
    const breakdownRow = document.getElementById('decgRetailBreakdownRow');
    const breakdownLabel = document.getElementById('decgRetailBreakdownLabel');
    const breakdownValue = document.getElementById('decgRetailBreakdownValue');
    const extraStitchRow = document.getElementById('decgRetailExtraStitchRow');
    const extraStitchLabel = document.getElementById('decgRetailExtraStitchLabel');
    const extraStitchValue = document.getElementById('decgRetailExtraStitchValue');
    const heavyweightRow = document.getElementById('decgRetailHeavyweightRow');
    const ltmBreakdownRow = document.getElementById('decgRetailLtmBreakdownRow');
    const ltmBreakdownLabel = document.getElementById('decgRetailLtmBreakdownLabel');
    const ltmBreakdownValue = document.getElementById('decgRetailLtmBreakdownValue');
    const finalUnitPriceEl = document.getElementById('decgRetailFinalUnitPrice');

    const tier = getTierFromQuantity(quantity);

    // Hide stitch count and heavyweight for laser patch
    if (itemType === 'laser-patch') {
        stitchesGroup.classList.add('hidden');
        heavyweightGroup.classList.add('hidden');
    } else {
        stitchesGroup.classList.remove('hidden');
        heavyweightGroup.classList.remove('hidden');
    }

    // LTM threshold for DECG is 7 pieces
    const ltmThreshold = DECG_RETAIL_PRICING.caps.ltmThreshold || 7;
    const ltmFeeAmount = DECG_RETAIL_PRICING.caps.ltmFee || 50;

    // ---- LASER PATCH CALCULATION ----
    if (itemType === 'laser-patch') {
        // Use CONTRACT pricing for cap 8K rate + $5, rounded up to nearest $0.50
        // This ensures consistent laser patch pricing across all tabs
        const capRate = CONTRACT_PRICING.caps.perThousandRates[tier];
        const cap8kPrice = capRate * 8; // 8K stitches
        const patchUpcharge = 5.00;
        const rawPrice = cap8kPrice + patchUpcharge;
        const laserPatchPrice = Math.ceil(rawPrice * 2) / 2; // Round up to nearest $0.50

        // Show breakdown
        if (quantity > 0) {
            breakdownRow.classList.remove('hidden');
            breakdownLabel.textContent = `Laser Patch:`;
            breakdownValue.textContent = formatPrice(laserPatchPrice);
        } else {
            breakdownRow.classList.add('hidden');
        }

        // Hide extra stitch and heavyweight rows (not applicable)
        extraStitchRow.classList.add('hidden');
        heavyweightRow.classList.add('hidden');

        // Calculate LTM (uses DECG threshold: 7)
        const ltmResult = calculateUnitPriceWithLTM(laserPatchPrice, quantity, ltmThreshold, ltmFeeAmount);

        if (ltmResult.hasLtm && quantity > 0) {
            ltmBreakdownRow.classList.remove('hidden');
            ltmBreakdownLabel.textContent = `+ LTM ($${ltmFeeAmount} ÷ ${quantity}):`;
            ltmBreakdownValue.textContent = '+' + formatPrice(ltmResult.ltmPerPiece);
        } else {
            ltmBreakdownRow.classList.add('hidden');
        }

        finalUnitPriceEl.textContent = formatPrice(ltmResult.finalUnitPrice);
        return;
    }

    // ---- GARMENT/CAP CALCULATION ----
    let pricing, baseStitches, perThousandUpcharge;

    if (itemType === 'garment') {
        pricing = DECG_RETAIL_PRICING.garments;
    } else {
        pricing = DECG_RETAIL_PRICING.caps;
    }

    const basePrice = pricing.basePrices[tier] || 0;
    baseStitches = pricing.baseStitches || 8000;
    perThousandUpcharge = pricing.perThousandUpcharge || 1.25;
    const itemLtmThreshold = pricing.ltmThreshold || 7;
    const itemLtmFeeAmount = pricing.ltmFee || 50;

    // Calculate extra stitch charge
    const extraK = Math.max(0, (stitches - baseStitches) / 1000);
    const extraCharge = extraK * perThousandUpcharge;
    let baseUnitPrice = basePrice + extraCharge;

    // Show breakdown
    if (quantity > 0) {
        breakdownRow.classList.remove('hidden');
        breakdownLabel.textContent = `Base (${baseStitches / 1000}K):`;
        breakdownValue.textContent = formatPrice(basePrice);

        if (extraK > 0) {
            extraStitchRow.classList.remove('hidden');
            extraStitchLabel.textContent = `+${extraK.toFixed(0)}K extra:`;
            extraStitchValue.textContent = '+' + formatPrice(extraCharge);
        } else {
            extraStitchRow.classList.add('hidden');
        }
    } else {
        breakdownRow.classList.add('hidden');
        extraStitchRow.classList.add('hidden');
    }

    // Heavyweight surcharge (added to base before LTM calculation)
    const heavyweightSurcharge = DECG_RETAIL_PRICING.heavyweightSurcharge || 10.00;
    if (isHeavyweight) {
        heavyweightRow.classList.remove('hidden');
        baseUnitPrice += heavyweightSurcharge;
    } else {
        heavyweightRow.classList.add('hidden');
    }

    // Calculate final price with LTM built in
    const ltmResult = calculateUnitPriceWithLTM(baseUnitPrice, quantity, itemLtmThreshold, itemLtmFeeAmount);

    // Show LTM breakdown if applicable
    if (ltmResult.hasLtm && quantity > 0) {
        ltmBreakdownRow.classList.remove('hidden');
        ltmBreakdownLabel.textContent = `+ LTM ($${itemLtmFeeAmount} ÷ ${quantity}):`;
        ltmBreakdownValue.textContent = '+' + formatPrice(ltmResult.ltmPerPiece);
    } else {
        ltmBreakdownRow.classList.add('hidden');
    }

    // Final unit price (emphasized)
    finalUnitPriceEl.textContent = formatPrice(ltmResult.finalUnitPrice);
}

// ============================================
// PRINT CONTRACT PRICING
// ============================================

// Stitch counts for print version (5K-15K only)
const PRINT_STITCH_COUNTS = [5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000];

/**
 * Generate and print contract pricing PDF
 * Shows Garments and Caps tables (5K-15K) plus Laser Patch pricing
 */
function printContractPricing() {
    if (!CONTRACT_PRICING) {
        alert('Pricing data not loaded. Please refresh the page.');
        return;
    }

    // Build print tables
    buildPrintGarmentsTable();
    buildPrintCapsTable();
    buildPrintLaserPatchTable();

    // Set custom filename for PDF save (browsers use document.title)
    const originalTitle = document.title;
    document.title = 'NW Custom Apparel Contract Embroidery Pricing 2026';

    // Trigger browser print dialog
    window.print();

    // Restore original title after print dialog opens
    document.title = originalTitle;
}

/**
 * Build print-specific garments table (5K-15K only)
 */
function buildPrintGarmentsTable() {
    const tbody = document.querySelector('#printContractGarmentsTable tbody');
    if (!tbody || !CONTRACT_PRICING.garments) return;

    const rates = CONTRACT_PRICING.garments.perThousandRates;
    let html = '';

    PRINT_STITCH_COUNTS.forEach(stitches => {
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const rate = rates[tier];
            const price = (stitches / 1000) * rate;
            const ltmClass = idx <= 1 ? ' class="ltm-col"' : '';
            html += `<td${ltmClass}>${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Add rate footer row
    html += '<tr class="rate-row">';
    html += '<td><strong>$/1K</strong></td>';
    TIER_ORDER.forEach((tier, idx) => {
        const rate = rates[tier];
        const ltmClass = idx <= 1 ? ' class="ltm-col"' : '';
        html += `<td${ltmClass}><strong>${formatPrice(rate)}</strong></td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

/**
 * Build print-specific caps table (5K-15K only)
 */
function buildPrintCapsTable() {
    const tbody = document.querySelector('#printContractCapsTable tbody');
    if (!tbody || !CONTRACT_PRICING.caps) return;

    const rates = CONTRACT_PRICING.caps.perThousandRates;
    let html = '';

    PRINT_STITCH_COUNTS.forEach(stitches => {
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const rate = rates[tier];
            const price = (stitches / 1000) * rate;
            const ltmClass = idx <= 1 ? ' class="ltm-col"' : '';
            html += `<td${ltmClass}>${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Add rate footer row
    html += '<tr class="rate-row">';
    html += '<td><strong>$/1K</strong></td>';
    TIER_ORDER.forEach((tier, idx) => {
        const rate = rates[tier];
        const ltmClass = idx <= 1 ? ' class="ltm-col"' : '';
        html += `<td${ltmClass}><strong>${formatPrice(rate)}</strong></td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

/**
 * Build laser patch pricing table for print
 * Formula: (Contract Cap 8K rate × 8) + $5, rounded up to $0.50
 */
function buildPrintLaserPatchTable() {
    const tbody = document.querySelector('#printLaserPatchTable tbody');
    if (!tbody || !CONTRACT_PRICING.caps) return;

    const rates = CONTRACT_PRICING.caps.perThousandRates;
    const tiers = [
        { label: '1-7 pcs', key: '1-7' },
        { label: '8-23 pcs', key: '8-23' },
        { label: '24-47 pcs', key: '24-47' },
        { label: '48-71 pcs', key: '48-71' },
        { label: '72+ pcs', key: '72+' }
    ];

    let html = '';

    tiers.forEach(tier => {
        const capRate = rates[tier.key];
        const cap8kPrice = capRate * 8; // 8K stitches
        const patchUpcharge = 5.00;
        const rawPrice = cap8kPrice + patchUpcharge;
        const laserPatchPrice = Math.ceil(rawPrice * 2) / 2; // Round up to nearest $0.50

        html += '<tr>';
        html += `<td>${tier.label}</td>`;
        html += `<td>${formatPrice(laserPatchPrice)}</td>`;
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

// Make printContractPricing globally available
window.printContractPricing = printContractPricing;

// ============================================
// COPY SHAREABLE LINK
// ============================================

/**
 * Copy shareable contract pricing page URL to clipboard
 */
function copyShareableLink() {
    const shareUrl = `${window.location.origin}/pages/embroidery-contract-pricing.html`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        // Visual feedback
        const btn = document.querySelector('.share-link-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Link copied to clipboard!');
    });
}

window.copyShareableLink = copyShareableLink;

// ============================================
// CUSTOMER SURCHARGE LIST (Stitch Charges Tab)
// ============================================

// [rep, cid, company, design, orders, stitches, tier, fullPrice, gfPrice, savings]
const ES_CUST_DATA = [["Nika Lao", "10181", "Binford Metals LLC", "Binford Metals JB", "1", "41,330", "Full Back", "DECG-FB", "$31.50", "\u2014"], ["Nika Lao", "13271", "Fenton Communication", "Strategy & Impact", "1", "41,523", "Full Back", "DECG-FB", "$31.50", "\u2014"], ["Nika Lao", "3409", "Little Wheels QMA", "Little Wheels QMA - Champion", "3", "51,380", "Full Back", "DECG-FB", "$41.50", "\u2014"], ["Nika Lao", "3409", "Little Wheels QMA", "NEON THUNDER LOGO", "2", "73,405", "Full Back", "DECG-FB", "$63.50", "\u2014"], ["Nika Lao", "9466", "Pacific Harbors Council (Boy Sco", "Clay Classic", "1", "25,051", "Full Back", "DECG-FB", "$15.00", "\u2014"], ["Nika Lao", "13256", "Pod Pack International, LLC", "Pod Pack Joe's Garage Coffee", "1", "28,853", "Full Back", "DECG-FB", "$19.00", "\u2014"], ["Nika Lao", "11758", "Redi National Pest Eliminators", "Redi National Pest Eliminators", "1", "38,754", "Full Back", "DECG-FB", "$29.00", "\u2014"], ["Nika Lao", "11758", "Redi National Pest Eliminators", "Redi National Pest Left Chest & Cap - Bl", "4", "40,215", "Full Back", "DECG-FB", "$30.00", "\u2014"], ["Taneisha Clark", "13268", "Ironside Marine", "Ironside Marine- fullback", "2", "82,733", "Full Back", "DECG-FB", "$72.50", "\u2014"], ["Taneisha Clark", "13535", "Phinney Books", "TRUE Phinney Books", "1", "34,945", "Full Back", "DECG-FB", "$25.00", "\u2014"], ["Taneisha Clark", "13143", "Special Services Landscaping", "Special Services Landscaping", "1", "34,110", "Full Back", "DECG-FB", "$24.00", "\u2014"], ["House", "8933", "Pet Ponderosa", "PetPonderosa Circle Logo", "1", "22,591", "Large", "$10.00", "$10.00", "Same"], ["Nika Lao", "13547", "A Advanced Services", "WOSSA", "1", "16,548", "Large", "$10.00", "$6.50", "-$3.50"], ["Nika Lao", "13319", "Brett Skaloud", "TUTHDR20", "1", "18,407", "Large", "$10.00", "$8.50", "-$1.50"], ["Nika Lao", "11410", "City Of Algona", "City of Algona -", "1", "16,165", "Large", "$10.00", "$6.00", "-$4.00"], ["Nika Lao", "4460", "City of Federal Way - Police Dep", "POLICE BADGE QUARTERMASTER", "1", "18,568", "Large", "$10.00", "$8.50", "-$1.50"], ["Nika Lao", "12420", "Contractors Roof Service INC", "CRS Roofing Service", "1", "18,115", "Large", "$10.00", "$8.00", "-$2.00"], ["Nika Lao", "12693", "Diana Chudak", "VA", "1", "17,770", "Large", "$10.00", "$8.00", "-$2.00"], ["Nika Lao", "9886", "HARTS Services", "Harts filled in", "4", "15,697", "Large", "$10.00", "$5.50", "-$4.50"], ["Nika Lao", "6924", "Lavelle Vac and Drainage", "P3690, LC, La Velle Vac and Drainage J13", "1", "21,792", "Large", "$10.00", "$10.00", "Same"], ["Nika Lao", "3409", "Little Wheels QMA", "M5160 F/B 2022 Points Challenge", "2", "20,865", "Large", "$10.00", "$10.00", "Same"], ["Nika Lao", "12643", "Mike McLeod", "Team USA", "1", "15,451", "Large", "$10.00", "$5.50", "-$4.50"], ["Nika Lao", "7678", "Moose Radiator", "Moose Radiator 1-800-Radiator & A/C", "2", "15,867", "Large", "$10.00", "$6.00", "-$4.00"], ["Nika Lao", "12523", "Oak Harbor Freight Lines, Inc", "Oak Harbor University (L.E.A.D) 2.25\" -", "1", "19,461", "Large", "$10.00", "$9.50", "-$0.50"], ["Nika Lao", "2633", "Olympic Pipeline", "BP Drone Pilot", "1", "18,317", "Large", "$10.00", "$8.50", "-$1.50"], ["Nika Lao", "12161", "Paradigm Building Contractors", "PBG - FB", "1", "23,681", "Large", "$10.00", "$10.00", "Same"], ["Nika Lao", "7421", "Puyallup Tribal Housing", "Puyallup Tribal Housing  - North Face Ja", "1", "16,175", "Large", "$10.00", "$6.00", "-$4.00"], ["Nika Lao", "10216", "Puyallup Tribe - Elder Dept", "L/C Logo - Puyallup Tribe Elders Dept", "2", "16,342", "Large", "$10.00", "$6.50", "-$3.50"], ["Nika Lao", "13477", "Racing Rascals", "RRQMA", "1", "15,409", "Large", "$10.00", "$5.50", "-$4.50"], ["Nika Lao", "12646", "Rainier Division Fab Shop", "Rainier Division Fab Shop", "1", "16,711", "Large", "$10.00", "$6.50", "-$3.50"], ["Nika Lao", "6271", "Rockin A & J Trucking", "Rockin' A&J Angus Ranch - Left chest", "1", "24,312", "Large", "$10.00", "$10.00", "Same"], ["Nika Lao", "13402", "Steilacoom Kiwanis", "Steilacoom Kiwanis - High School Key Clu", "1", "24,451", "Large", "$10.00", "$10.00", "Same"], ["Nika Lao", "13344", "UW - School Of Medicine", "UW - School Of Medicine Husky", "3", "20,705", "Large", "$10.00", "$10.00", "Same"], ["Nika Lao", "9931", "Yorker Electric & Service LLC", "Yorker Electric- No phone number", "1", "22,542", "Large", "$10.00", "$10.00", "Same"], ["Taneisha Clark", "1868", "Combined Carriers Co.", "Combined Carriers Company Heavy Haul Puy", "1", "17,829", "Large", "$10.00", "$8.00", "-$2.00"], ["Taneisha Clark", "1868", "Combined Carriers Co.", "Combined Carriers Puyallup, WA", "1", "16,530", "Large", "$10.00", "$6.50", "-$3.50"], ["Taneisha Clark", "4042", "Gene's Towing", "Fitz Auto - Black", "1", "15,970", "Large", "$10.00", "$6.00", "-$4.00"], ["Taneisha Clark", "12030", "Infinity Fire Protection", "Infinity Fire Protection", "1", "16,819", "Large", "$10.00", "$7.00", "-$3.00"], ["Taneisha Clark", "8045", "PICK-QUICK Operating Company LLC", "J1152, L/C, Pick Quick Drive Thru", "2", "16,834", "Large", "$10.00", "$7.00", "-$3.00"], ["Taneisha Clark", "13120", "Pierce County Incident Managemen", "Pierce County Incident Management Team", "1", "17,110", "Large", "$10.00", "$7.00", "-$3.00"], ["Taneisha Clark", "10819", "SSC Contractors II", "SSC Tomanamus JB", "1", "20,138", "Large", "$10.00", "$10.00", "Same"], ["Taneisha Clark", "13527", "TMG Earthworks LLC", "TMG Stacked", "1", "15,152", "Large", "$10.00", "$5.00", "-$5.00"], ["House", "8537", "B&B Construction & Remodeling LL", "B&B Construction & Remodeling, LLC", "1", "11,867", "Mid", "$4.00", "$2.00", "-$2.00"], ["House", "13303", "Carolyn Salter", "Testical Festival", "1", "11,977", "Mid", "$4.00", "$2.00", "-$2.00"], ["House", "4077", "Central Pierce County Fire & Res", "Crew 6", "1", "11,745", "Mid", "$4.00", "$1.50", "-$2.50"], ["House", "7750", "Highline Community Band", "Highline Community Band (2020 New Logo)", "1", "10,010", "Mid", "$4.00", "$0.50", "-$3.50"], ["House", "4932", "Los Compadres Del Cigarro", "P3337 L/C LosCompadresTENYEAR - BLACK- P", "1", "14,459", "Mid", "$4.00", "$4.00", "Same"], ["Nika Lao", "9537", "Aero Construction", "F/Hat Aero Construction Logo - Camo,Neon", "1", "10,156", "Mid", "$4.00", "$0.50", "-$3.50"], ["Nika Lao", "10181", "Binford Metals LLC", "Binford Metals Recycling & Auto Wrecking", "1", "11,923", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "8997", "Browns Point Fire #13", "L/C, Pierce County Browns Pt./Dash Pt. F", "1", "14,483", "Mid", "$4.00", "$4.00", "Same"], ["Nika Lao", "12131", "Button Veterinary Hospital", "Button Veterinary", "1", "13,233", "Mid", "$4.00", "$3.00", "-$1.00"], ["Nika Lao", "12229", "Canber Landscaping", "Canber Landscaping Full Logo", "1", "11,223", "Mid", "$4.00", "$1.00", "-$3.00"], ["Nika Lao", "12229", "Canber Landscaping", "Canber Landscaping Full Logo - Maroon", "1", "11,223", "Mid", "$4.00", "$1.00", "-$3.00"], ["Nika Lao", "4460", "City of Federal Way - Police Dep", "Valley SWAT Badge - L/C", "1", "11,919", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "12693", "Diana Chudak", "MICU/CCU RN", "1", "12,438", "Mid", "$4.00", "$2.50", "-$1.50"], ["Nika Lao", "7836", "Federal Way Police", "J379, L/C Federal Way Police Detective B", "2", "12,030", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "12334", "Fire Buffs", "Fire Buff (Fire Logo)", "1", "10,424", "Mid", "$4.00", "$0.50", "-$3.50"], ["Nika Lao", "12349", "Grandview Early Learning Center", "Grandview Early Learning Center", "2", "10,884", "Mid", "$4.00", "$1.00", "-$3.00"], ["Nika Lao", "11970", "H Con Inc", "South Sound Kings - Youth Hockey", "1", "12,660", "Mid", "$4.00", "$2.50", "-$1.50"], ["Nika Lao", "12188", "Hi Grade Asphalt", "Hi Grade Asphalt - FB", "1", "14,703", "Mid", "$4.00", "$4.00", "Same"], ["Nika Lao", "12907", "Hilltop Heritage Middle School", "Hilltop Heritage Middle School", "1", "11,896", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "550", "Inderbitzin Distributors", "Summit Snacks Jerky - With no trees", "1", "12,947", "Mid", "$4.00", "$3.00", "-$1.00"], ["Nika Lao", "12894", "Legacy Protective", "Legacy Protective", "3", "14,437", "Mid", "$4.00", "$4.00", "Same"], ["Nika Lao", "13332", "Lemon Squeezy", "Lemon Squeezy", "1", "10,355", "Mid", "$4.00", "$0.50", "-$3.50"], ["Nika Lao", "12924", "Molen Oral & Implant Surgery", "Molen Oral & Implant Surgery", "2", "11,988", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "547", "Mountain View Edgewood Water Co.", "Mt. View-Edgewood Water Co. - DARKS", "3", "13,032", "Mid", "$4.00", "$3.00", "-$1.00"], ["Nika Lao", "547", "Mountain View Edgewood Water Co.", "Mt. View-Edgewood Water Co. Large  - DA", "3", "12,228", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "547", "Mountain View Edgewood Water Co.", "Mt. View-Edgewood Water Co. Large  - LI", "3", "12,228", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "547", "Mountain View Edgewood Water Co.", "Mt View-Edgewood Water Company - 100 Yea", "1", "13,291", "Mid", "$4.00", "$3.50", "-$0.50"], ["Nika Lao", "12988", "NW Chapter ATHS", "NW Chapter ATHS", "2", "12,306", "Mid", "$4.00", "$2.50", "-$1.50"], ["Nika Lao", "9466", "Pacific Harbors Council (Boy Sco", "Bushmaster NYLT- LC", "3", "12,296", "Mid", "$4.00", "$2.50", "-$1.50"], ["Nika Lao", "2685", "Patriot Metal Finishing Systems", "L619 L/C Patriot Powder Coatings - Navy-", "1", "13,632", "Mid", "$4.00", "$3.50", "-$0.50"], ["Nika Lao", "2685", "Patriot Metal Finishing Systems", "Patriot Metal Finishing Flag in Circle.", "1", "13,024", "Mid", "$4.00", "$3.00", "-$1.00"], ["Nika Lao", "315", "Puyallup High School", "VIKING KNIGHTS AND LADIES", "1", "10,530", "Mid", "$4.00", "$0.50", "-$3.50"], ["Nika Lao", "11901", "Puyallup Tribe Of Indians", "Puyallup Tribe Indians - Child Support P", "1", "10,835", "Mid", "$4.00", "$1.00", "-$3.00"], ["Nika Lao", "11901", "Puyallup Tribe Of Indians", "Puyallup Tribe Of Indians Champions", "1", "13,671", "Mid", "$4.00", "$3.50", "-$0.50"], ["Nika Lao", "13393", "Realfine Painting", "Realfine Painting", "1", "11,704", "Mid", "$4.00", "$1.50", "-$2.50"], ["Nika Lao", "6271", "Rockin A & J Trucking", "P1938, L/C Rocking A & J Trucking", "1", "10,100", "Mid", "$4.00", "$0.50", "-$3.50"], ["Nika Lao", "7273", "Scarsella Brothers Inc.", "Scarsella - Polo", "2", "14,449", "Mid", "$4.00", "$4.00", "Same"], ["Nika Lao", "7273", "Scarsella Brothers Inc.", "Scarsella - Red/White/Blue Logo", "2", "14,449", "Mid", "$4.00", "$4.00", "Same"], ["Nika Lao", "8109", "Smokin' Kue / A.P.A", "L204, L/C APA", "1", "12,614", "Mid", "$4.00", "$2.50", "-$1.50"], ["Nika Lao", "8109", "Smokin' Kue / A.P.A", "L205,  F/B American Pool Players Associa", "7", "12,614", "Mid", "$4.00", "$2.50", "-$1.50"], ["Nika Lao", "10770", "Sound Truck & Trailer Repair", "STTR FB- Outline Only", "1", "12,612", "Mid", "$4.00", "$2.50", "-$1.50"], ["Nika Lao", "2715", "Spartan Band Association", "Sumner high School Color Guard", "1", "11,858", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "13137", "Town And County Auto Repair", "Town And County Auto Repair", "1", "10,976", "Mid", "$4.00", "$1.00", "-$3.00"], ["Nika Lao", "13236", "VRC Metal Systems, LLC", "Heartland", "1", "11,886", "Mid", "$4.00", "$2.00", "-$2.00"], ["Nika Lao", "4461", "Veneer Chip Transport, Inc.", "Pelland LLC - T-shirts", "1", "10,564", "Mid", "$4.00", "$0.50", "-$3.50"], ["Nika Lao", "4461", "Veneer Chip Transport, Inc.", "VCT 3 Colors 3\"", "5", "10,802", "Mid", "$4.00", "$1.00", "-$3.00"], ["Nika Lao", "5398", "WSU Construction Management", "WSU Construction Management", "2", "10,908", "Mid", "$4.00", "$1.00", "-$3.00"], ["Nika Lao", "5398", "WSU Construction Management", "WSU Construction Management with updated", "2", "13,564", "Mid", "$4.00", "$3.50", "-$0.50"], ["Taneisha Clark", "6695", "City of Tacoma (Facilities)", "City of Tacoma Facilities Square- 2025", "4", "13,238", "Mid", "$4.00", "$3.00", "-$1.00"], ["Taneisha Clark", "13171", "Davita Kidney Care", "Davita", "1", "12,763", "Mid", "$4.00", "$3.00", "-$1.00"], ["Taneisha Clark", "10800", "Domino's - Team Seattle", "Domino's Red Sun", "1", "11,901", "Mid", "$4.00", "$2.00", "-$2.00"], ["Taneisha Clark", "13451", "Eastside Hardwood LLC", "Eastside Hardwood EMB", "1", "12,815", "Mid", "$4.00", "$3.00", "-$1.00"], ["Taneisha Clark", "5204", "Gary Kolano", "Lincoln High School Alumni", "2", "13,152", "Mid", "$4.00", "$3.00", "-$1.00"], ["Taneisha Clark", "4042", "Gene's Towing", "Fitz Auto", "1", "12,136", "Mid", "$4.00", "$2.00", "-$2.00"], ["Taneisha Clark", "4042", "Gene's Towing", "L349, L/C Gene's Towing and Transportati", "1", "12,136", "Mid", "$4.00", "$2.00", "-$2.00"], ["Taneisha Clark", "12807", "Golden Services LLC", "Golden Services", "3", "10,819", "Mid", "$4.00", "$1.00", "-$3.00"], ["Taneisha Clark", "9086", "Hunt's Services, LLC", "HUNT'S SERVICES TEXT ONLY", "1", "12,224", "Mid", "$4.00", "$2.00", "-$2.00"], ["Taneisha Clark", "2136", "Old Cannery Furniture", "Daffodil Festival", "1", "10,494", "Mid", "$4.00", "$0.50", "-$3.50"], ["Taneisha Clark", "2136", "Old Cannery Furniture", "Old Cannery- Furniture Warehouse", "2", "12,021", "Mid", "$4.00", "$2.00", "-$2.00"], ["Taneisha Clark", "13567", "Pierce Roof Pros", "IKO", "1", "10,230", "Mid", "$4.00", "$0.50", "-$3.50"], ["Taneisha Clark", "12998", "Rainier View Rooter", "Rainier View Rooter", "1", "13,724", "Mid", "$4.00", "$3.50", "-$0.50"], ["Taneisha Clark", "11942", "Sherlock Investments", "Sherlock Self Storage - Green, Forest Gr", "5", "11,282", "Mid", "$4.00", "$1.50", "-$2.50"], ["Taneisha Clark", "4169", "Smith Brothers Farms", "L275, L/C 2011 Smith Brothers Farms Don'", "1", "13,649", "Mid", "$4.00", "$3.50", "-$0.50"], ["Taneisha Clark", "534", "Tacoma Yacht Club", "2025 Daffodil Marine Festival", "1", "14,427", "Mid", "$4.00", "$4.00", "Same"], ["Taneisha Clark", "13260", "Wood and Stoane", "Wood and Stoane New EMB 2025", "1", "11,304", "Mid", "$4.00", "$1.50", "-$2.50"]];

let esCustActiveRep = 'all';
let esCustActiveTier = 'all';

function esCustRepTag(r) {
    if (r === 'Nika Lao') return '<span class="es-rep-tag es-rep-tag--nika">Nika</span>';
    if (r === 'Taneisha Clark') return '<span class="es-rep-tag es-rep-tag--taneisha">Taneisha</span>';
    return '<span class="es-rep-tag es-rep-tag--house">' + esCustEscHtml(r) + '</span>';
}

function esCustTierTag(t) {
    if (t === 'Full Back') return '<span class="es-tier-sm es-tier-sm--fb">Full Back</span>';
    if (t === 'Large') return '<span class="es-tier-sm es-tier-sm--large">Large</span>';
    return '<span class="es-tier-sm es-tier-sm--mid">Mid</span>';
}

function esCustSavingsClass(s) {
    if (s === 'Same' || s === '\u2014') return 'es-savings es-savings--same';
    return 'es-savings es-savings--good';
}

function esCustEscHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function esCustFilterTable() {
    var q = document.getElementById('custSearch').value.toLowerCase();
    var body = document.getElementById('custBody');
    var html = '';
    var count = 0;

    ES_CUST_DATA.forEach(function(row) {
        var rep = row[0], cid = row[1], co = row[2], design = row[3];
        var stitches = row[5], tier = row[6], fp = row[7], gf = row[8], sv = row[9];

        if (esCustActiveRep !== 'all' && rep !== esCustActiveRep) return;
        if (esCustActiveTier !== 'all' && tier !== esCustActiveTier) return;
        if (q && co.toLowerCase().indexOf(q) === -1 && design.toLowerCase().indexOf(q) === -1 && cid.indexOf(q) === -1) return;

        count++;
        html += '<tr>'
            + '<td>' + esCustRepTag(rep) + '</td>'
            + '<td class="es-col-co">' + esCustEscHtml(co) + '<br><span style="font-size:11px;color:#94a3b8;font-weight:400">#' + cid + '</span></td>'
            + '<td class="es-col-d">' + esCustEscHtml(design) + '</td>'
            + '<td style="white-space:nowrap">' + stitches + '</td>'
            + '<td>' + esCustTierTag(tier) + '</td>'
            + '<td class="es-gf-price es-tooltip" data-tip="Use this price through Dec 2026. Full price starts Jan 2027.">' + gf + '</td>'
            + '<td>' + fp + '</td>'
            + '<td class="' + esCustSavingsClass(sv) + '">' + sv + '</td>'
            + '</tr>';
    });

    body.innerHTML = html;
    document.getElementById('noResults').style.display = count === 0 ? 'block' : 'none';
    document.getElementById('resultCount').innerHTML = '<strong>' + count + '</strong> of 107 designs';
}

function esCustToggleFilter(btn) {
    var group = btn.dataset.filter;
    document.querySelectorAll('.es-filter-btn[data-filter="' + group + '"]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    if (group === 'rep') esCustActiveRep = btn.dataset.val;
    if (group === 'tier') esCustActiveTier = btn.dataset.val;
    esCustFilterTable();
}

function openCustPanel() {
    document.getElementById('custOverlay').classList.add('open');
    document.getElementById('custPanel').classList.add('open');
    document.body.style.overflow = 'hidden';
    esCustFilterTable();
    setTimeout(function() { document.getElementById('custSearch').focus(); }, 350);
}

function closeCustPanel() {
    document.getElementById('custOverlay').classList.remove('open');
    document.getElementById('custPanel').classList.remove('open');
    document.body.style.overflow = '';
}

// ESC key to close panel
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeCustPanel();
});

// Floating tooltip
(function() {
    var tip = document.createElement('div');
    tip.className = 'es-tooltip-float';
    document.body.appendChild(tip);

    document.addEventListener('mouseover', function(e) {
        var el = e.target.closest('.es-tooltip');
        if (el && el.dataset.tip) {
            tip.textContent = el.dataset.tip;
            tip.classList.add('visible');
            var r = el.getBoundingClientRect();
            var tw = 250;
            var left = r.left + r.width / 2 - tw / 2;
            if (left < 8) left = 8;
            if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
            var top = r.top - tip.offsetHeight - 8;
            if (top < 8) top = r.bottom + 8;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        }
    });

    document.addEventListener('mouseout', function(e) {
        var el = e.target.closest('.es-tooltip');
        if (el) tip.classList.remove('visible');
    });
})();

// Make customer panel functions globally available
window.openCustPanel = openCustPanel;
window.closeCustPanel = closeCustPanel;
window.esCustFilterTable = esCustFilterTable;
window.esCustToggleFilter = esCustToggleFilter;
