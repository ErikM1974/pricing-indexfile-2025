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
    if (tabParam && ['contract', 'al-retail', 'decg-retail'].includes(tabParam)) {
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

    console.log('Pricing data loaded from API:', {
        contract: CONTRACT_PRICING ? 'loaded' : 'failed',
        al: AL_RETAIL_PRICING ? 'loaded' : 'failed',
        decg: DECG_RETAIL_PRICING ? 'loaded' : 'failed'
    });
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
        // Fallback to default values - still show the card but log the error
        CAP_UPGRADES = {
            puff: { name: '3D Puff Embroidery', partNumber: '3D-EMB', price: 5.00 },
            patch: { name: 'Laser Faux Leather Patch', partNumber: 'Laser Patch', price: 5.00 }
        };
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
    let pricing, baseStitches, perThousandUpcharge;

    if (itemType === 'garment') {
        pricing = AL_RETAIL_PRICING.garments;
    } else {
        pricing = AL_RETAIL_PRICING.caps;
    }

    const basePrice = pricing.basePrices[tier] || 0;
    baseStitches = pricing.baseStitches || 8000;
    perThousandUpcharge = pricing.perThousandUpcharge || 1.25;
    const ltmThreshold = pricing.ltmThreshold || 7;
    const ltmFeeAmount = pricing.ltmFee || 50;

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
    const ltmResult = calculateUnitPriceWithLTM(baseUnitPrice, quantity, ltmThreshold, ltmFeeAmount);

    // Show LTM breakdown if applicable
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
    let pricing, baseStitches, perThousandUpcharge;

    if (itemType === 'garment') {
        pricing = DECG_RETAIL_PRICING.garments;
    } else {
        pricing = DECG_RETAIL_PRICING.caps;
    }

    const basePrice = pricing.basePrices[tier] || 0;
    baseStitches = pricing.baseStitches || 8000;
    perThousandUpcharge = pricing.perThousandUpcharge || 1.25;
    const ltmThreshold = pricing.ltmThreshold || 7;
    const ltmFeeAmount = pricing.ltmFee || 50;

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
    const ltmResult = calculateUnitPriceWithLTM(baseUnitPrice, quantity, ltmThreshold, ltmFeeAmount);

    // Show LTM breakdown if applicable
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
