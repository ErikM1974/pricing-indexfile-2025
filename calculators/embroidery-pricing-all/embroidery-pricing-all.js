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
let STITCH_CHARGE_DATA = null;

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

        // Build stitch-charges tab (API-driven)
        updateStitchChargesTierCards();
        buildStitchChargesFullBackTable();
        buildKeyAccountSurchargeList();

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

    // Fetch AS-Garm stitch surcharge data for stitch-charges tab
    await fetchStitchChargeData();
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
// STITCH CHARGES TAB (API-DRIVEN)
// ============================================

/**
 * Fetch AS-Garm stitch surcharge tiers from Caspio via pricing-bundle
 * Same data source as embroidery-quote-pricing.js uses (allEmbroideryCostsR)
 */
async function fetchStitchChargeData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pricing-bundle?method=EMB`);
        if (!response.ok) {
            throw new Error(`EMB pricing-bundle API error: ${response.status}`);
        }
        const data = await response.json();

        if (!data.allEmbroideryCostsR) return;

        // Sort by StitchCount ascending (same logic as embroidery-quote-pricing.js lines 163-178)
        const asGarmRows = data.allEmbroideryCostsR
            .filter(c => c.ItemType === 'AS-Garm')
            .sort((a, b) => a.StitchCount - b.StitchCount);

        if (asGarmRows.length >= 2) {
            STITCH_CHARGE_DATA = {
                midFee: asGarmRows[0].EmbroideryCost,
                largeFee: asGarmRows[1].EmbroideryCost,
                midThreshold: asGarmRows[0].StitchCount,
                largeThreshold: asGarmRows[1].StitchCount
            };
        }
    } catch (error) {
        console.error('Failed to fetch AS-Garm stitch charge data:', error);
        // Fallback: leave STITCH_CHARGE_DATA null, HTML defaults stay visible
    }
}

/**
 * Update the 3 tier cards on the stitch-charges tab with API data
 */
function updateStitchChargesTierCards() {
    if (!STITCH_CHARGE_DATA) return;

    const midPriceEl = document.getElementById('es-mid-price');
    const largePriceEl = document.getElementById('es-large-price');
    const midRangeEl = document.getElementById('es-mid-range');
    const largeRangeEl = document.getElementById('es-large-range');

    if (midPriceEl) {
        midPriceEl.textContent = `+$${STITCH_CHARGE_DATA.midFee}`;
    }
    if (largePriceEl) {
        largePriceEl.textContent = `+$${STITCH_CHARGE_DATA.largeFee}`;
    }
    if (midRangeEl) {
        const midStart = (10001).toLocaleString();
        const midEnd = STITCH_CHARGE_DATA.largeThreshold.toLocaleString();
        midRangeEl.textContent = `${midStart} – ${midEnd}`;
    }
    if (largeRangeEl) {
        const largeStart = (STITCH_CHARGE_DATA.largeThreshold + 1).toLocaleString();
        largeRangeEl.textContent = `${largeStart} – 25,000`;
    }
}

/**
 * Build the DECG-FB Full Back table on the stitch-charges tab from CONTRACT_PRICING
 * Uses the same data as the contract/AL/DECG Full Back tables
 */
function buildStitchChargesFullBackTable() {
    const tbody = document.getElementById('esFbTableBody');
    if (!tbody) return;

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

        TIER_ORDER.forEach(tier => {
            const rate = rates[tier];
            const stitchesK = stitches / 1000;
            const price = Math.max(stitchesK * rate, minPrice);
            html += `<td>${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    // Footer row with per-thousand rates
    html += '<tr class="es-fb-rate-row">';
    html += '<td>$ / 1K</td>';
    TIER_ORDER.forEach(tier => {
        const rate = rates[tier];
        html += `<td>${formatPrice(rate)}</td>`;
    });
    html += '</tr>';

    tbody.innerHTML = html;
}

/**
 * Key Account Surcharge List - Accordion data & rendering
 */
const KEY_ACCOUNT_SURCHARGES = [
    {
        name: "Scarsella Brothers Inc.",
        rep: "Nika Lao",
        designs: [
            { name: "Scarsella 80th Years", designNo: "39324", stitches: 18641, over: 8641, part: "AS-Garm", charge: 10 },
            { name: "Scarsella \u2014 Polo", designNo: null, stitches: 16799, over: 6799, part: "AS-Garm", charge: 10, ruthie: true },
            { name: "Scarsella \u2014 Red/White/Blue Logo", designNo: null, stitches: 24198, over: 14198, part: "AS-Garm", charge: 10, ruthie: true },
        ]
    },
    {
        name: "Pacific Power Group",
        rep: "Nika Lao / Taneisha Clark",
        designs: [
            { name: "MTU \u2014 Black", designNo: null, stitches: 18091, over: 8091, part: "AS-Garm", charge: 10, ruthie: true },
        ]
    },
    {
        name: "Archterra Landscape Services",
        rep: "Nika Lao",
        designs: [
            { name: "Archterra Tree on Top", designNo: "38685", stitches: 18829, over: 8829, part: "AS-Garm", charge: 10, note: "Verify # with Ruthie" },
            { name: "CAP BACK \u2014 Archterra (straight text) BLACK", designNo: "38685", stitches: 18666, over: 8666, part: "AS-CAP", charge: 10, note: "Verify # with Ruthie" },
        ]
    },
    {
        name: "Smith Brothers Farms",
        rep: "Nika Lao / Taylar Hanson / Taneisha Clark",
        designs: [
            { name: "Smith Brothers FB \u2014 Full Logo (garment back)", designNo: null, stitches: 19674, over: 9674, part: "AS-Garm", charge: 10, ruthie: true },
            { name: "Smith Brothers LC full logo", designNo: "38859", stitches: 11164, over: 1164, part: "AS-Garm", charge: 4, note: "Verify # with Ruthie" },
            { name: "Smith Brothers LC full logo \u2014 Carolina Blue", designNo: "38859", stitches: 11164, over: 1164, part: "AS-Garm", charge: 4, note: "Verify # with Ruthie" },
            { name: "Smith Brothers LC full logo \u2014 True Navy/Red", designNo: "38864", stitches: 13995, over: 3995, part: "AS-Garm", charge: 4, note: "Verify # with Ruthie" },
        ]
    },
    {
        name: "Patriot Fire Protection",
        rep: "Nika Lao",
        designs: [
            { name: "Patriot Fire Protection \u2014 Silver Logo", designNo: null, stitches: 23351, over: 13351, part: "AS-Garm", charge: 10, ruthie: true },
            { name: "Patriot Fire Protection \u2014 1/4 Zip", designNo: null, stitches: 12738, over: 2738, part: "AS-Garm", charge: 4, ruthie: true },
            { name: "Patriot Fire Protection \u2014 James Cho (all colors)", designNo: null, stitches: 12738, over: 2738, part: "AS-Garm", charge: 4, ruthie: true },
            { name: "Fire Sprinkle \u2014 Navy Blue", designNo: null, stitches: 11158, over: 1158, part: "AS-Garm", charge: 4, ruthie: true },
        ]
    },
    {
        name: "Greenleaf Landscaping",
        rep: "Nika Lao",
        designs: [
            { name: "Greenleaf \u2014 Black, Neon Orange", designNo: null, stitches: 20343, over: 10343, part: "AS-Garm", charge: 10, ruthie: true },
            { name: "Greenleaf \u2014 Charcoal / Yellow / Olive", designNo: null, stitches: 13562, over: 3562, part: "AS-Garm", charge: 4, ruthie: true },
        ]
    },
    {
        name: "Binford Metals LLC",
        rep: "Nika Lao",
        designs: [
            { name: "Binford Yakima (Large version)", designNo: null, stitches: 21812, over: 11812, part: "AS-Garm", charge: 10, ruthie: true },
            { name: "Binford Yakima \u2014 BLACK / Woodland Brown", designNo: "37440", stitches: 10906, over: 906, part: "AS-Garm", charge: 4, note: "Verify # with Ruthie" },
            { name: "BMC Logo ONLY Big logo", designNo: "33769", stitches: 10440, over: 440, part: "AS-Garm", charge: 4, note: "Verify # with Ruthie" },
            { name: "Binford Metals Recycling & Auto Wrecking", designNo: "39708", stitches: 11923, over: 1923, part: "AS-Garm", charge: 4 },
        ]
    },
    {
        name: "WSU Construction Management",
        rep: "Nika Lao",
        designs: [
            { name: "WSU Construction Mgmt \u2014 with updated tagline", designNo: "35138", stitches: 17737, over: 7737, part: "AS-Garm", charge: 10, note: "Verify # with Ruthie" },
        ]
    },
];

function keyAcctTierClass(charge) { return charge === 10 ? 'large' : 'mid'; }
function keyAcctChargeLabel(charge) { return charge === 10 ? '+$10.00 / piece' : '+$4.00 / piece'; }

function buildKeyAccountSurchargeList() {
    const list = document.getElementById('accountList');
    if (!list) return;

    KEY_ACCOUNT_SURCHARGES.forEach((acct, i) => {
        const tiers = [...new Set(acct.designs.map(d => d.charge))].sort((a, b) => b - a);
        const pillsHTML = tiers.map(c =>
            `<span class="es-tier-pill es-tier-pill--${keyAcctTierClass(c)}">${c === 10 ? 'Large +$10' : 'Mid +$4'}</span>`
        ).join('');

        const rowsHTML = acct.designs.map(d => {
            const tc = keyAcctTierClass(d.charge);
            const hasDesignNo = !!d.designNo;
            return `
                <tr>
                    <td>
                        <div class="es-d-name">${escapeHtmlStr(d.name)}</div>
                        ${d.note ? `<div class="es-d-note">\u26A0 ${escapeHtmlStr(d.note)}</div>` : ''}
                    </td>
                    <td class="td-c">
                        ${hasDesignNo
                            ? `<span class="es-d-no">${d.designNo}</span>`
                            : `<span class="es-d-no blank">\u2014</span>${d.ruthie ? '<div class="es-d-ruthie">Ask Ruthie</div>' : ''}`
                        }
                    </td>
                    <td class="td-r es-d-stitches">${d.stitches.toLocaleString()}</td>
                    <td class="td-r es-d-over">+${d.over.toLocaleString()}</td>
                    <td class="td-c"><span class="es-part-chip">${d.part}</span></td>
                    <td class="td-r"><span class="es-charge-val es-charge-val--${tc}">${keyAcctChargeLabel(d.charge)}</span></td>
                </tr>`;
        }).join('');

        const card = document.createElement('div');
        card.className = 'es-account-card';
        card.innerHTML = `
            <div class="es-account-hdr" onclick="this.parentElement.classList.toggle('open')">
                <div class="es-account-hdr-left">
                    <div class="es-acct-num">${i + 1}</div>
                    <div>
                        <div class="es-acct-name">${escapeHtmlStr(acct.name)}</div>
                        <div class="es-acct-rep">Rep: ${escapeHtmlStr(acct.rep)}</div>
                    </div>
                </div>
                <div class="es-acct-hdr-right">
                    ${pillsHTML}
                    <span class="es-chevron">&#9662;</span>
                </div>
            </div>
            <div class="es-design-wrap">
                <table class="es-design-table">
                    <thead>
                        <tr>
                            <th>Design Name</th>
                            <th class="th-c">Design #</th>
                            <th class="th-r">Stitches</th>
                            <th class="th-r">Over 10,000</th>
                            <th class="th-c">Part #</th>
                            <th class="th-r">Charge / Piece</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
            </div>`;
        list.appendChild(card);
    });
}

function escapeHtmlStr(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

