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
        initSurchargeModal();

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
// SURCHARGE CUSTOMER MODAL (227 accounts)
// ============================================

const SURCHARGE_CUSTOMERS = [{"id":8144,"company":"3 Dimensional Physical Therapy","first":"Paul","last":"Drumheller","email":"paul@3dimensionalpt.com","phone":"253-468-4700","rep":"House","tier":"Large","designs":[{"name":"3 Dimensional 3\" logo - Black","stitches":18118,"tier":"Large","charge":"+$10/pc","design_number":36424}]},{"id":12354,"company":"410 Dental","first":"Melissa","last":"Marroquim","email":"Melissa@410Dental.com","phone":"253-891-0977","rep":"Nika Lao","tier":"Mid","designs":[{"name":"410 Dental","stitches":13970,"tier":"Mid","charge":"+$4/pc","design_number":34915}]},{"id":13547,"company":"A Advanced Services","first":"Geoff","last":"Allen","email":"marketing@Aadvancedservices.com","phone":"253-259-5016","rep":"Nika Lao","tier":"Large","designs":[{"name":"WOSSA","stitches":16548,"tier":"Large","charge":"+$10/pc","design_number":40050}]},{"id":5281,"company":"Absher Construction Company","first":"William","last":"Johnson","email":"William.johnson@absherco.com","phone":"443-703-9136","rep":"Nika Lao","tier":"Both","designs":[{"name":"Absher logo - Omak Crew","stitches":15769,"tier":"Large","charge":"+$10/pc","design_number":23074},{"name":"Absher logo","stitches":12907,"tier":"Mid","charge":"+$4/pc","design_number":40057}]},{"id":11659,"company":"Absolute Heating & Cooling","first":"Carol","last":"Poole","email":"accounting@absoluteheatingcooling.com","phone":"253-740-1621","rep":"Nika Lao","tier":"Large","designs":[{"name":"Absolute LC","stitches":23982,"tier":"Large","charge":"+$10/pc","design_number":31353}]},{"id":9537,"company":"Aero Construction","first":"Sue","last":"McDonough","email":"AR7@pceaero.com","phone":"425-334-0082","rep":"Nika Lao","tier":"Mid","designs":[{"name":"F/Hat Aero Construction Logo - Camo,Neon Orange, Neon Green, Neon blue","stitches":10156,"tier":"Mid","charge":"+$4/pc","design_number":22331}]},{"id":12473,"company":"Alaska Trophy Adventures Lodge","first":"Wayne","last":"McGee","email":"atalodge.wayne@gmail.com","phone":"219-688-3675","rep":"Nika Lao","tier":"Large","designs":[{"name":"Alaska Trophy Adventures 5\"","stitches":19092,"tier":"Large","charge":"+$10/pc","design_number":35667}]},{"id":13092,"company":"Alaska West Express","first":"Kara","last":"Peterson","email":"kara@Lynden.com","phone":"253-830-6111","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Alaska West Express - Full Logo  - Beanies","stitches":10048,"tier":"Mid","charge":"+$4/pc","design_number":38401}]},{"id":1821,"company":"Arrow Lumber and Hardware","first":"STEVE","last":"PUTNEY","email":"steve@arrowlumber.com","phone":"2536865101","rep":"Taneisha Clark","tier":"Both","designs":[{"name":"ODA 781","stitches":21285,"tier":"Large","charge":"+$10/pc","design_number":34668},{"name":"P3907, Cap 4\"  & L/C.  Arrow Lumber - CHARCOAL, BLACK, Dark Heather, Graphite","stitches":12527,"tier":"Mid","charge":"+$4/pc","design_number":34670}]},{"id":2054,"company":"Art Morrison Enterprises","first":"D'Arcy","last":"Carnahan","email":"darcyc@artmorrison.com","phone":"253-922-7188","rep":"Nika Lao","tier":"Large","designs":[{"name":"Morrison Performance AM Quality - New Logo  - BLACK","stitches":24402,"tier":"Large","charge":"+$10/pc","design_number":24460}]},{"id":13261,"company":"Augusta Lawn Care","first":"Everlynn","last":"Velasquez","email":"edgewood@augustalawncareservices.com","phone":"206-779-0683","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Augusta Lawn Care with Dog","stitches":14040,"tier":"Mid","charge":"+$4/pc","design_number":38942}]},{"id":8537,"company":"B&B Construction & Remodeling LLC","first":"Mark","last":"Barber","email":"mark@1callusa.com","phone":"206-571-4777","rep":"House","tier":"Mid","designs":[{"name":"B&B Construction & Remodeling, LLC","stitches":11867,"tier":"Mid","charge":"+$4/pc","design_number":29089}]},{"id":901,"company":"Bates Technical College","first":"Hannah","last":"Herber","email":"hannah.herber@batestech.edu","phone":"253-376-3411","rep":"House","tier":"Mid","designs":[{"name":"Bates Technical College","stitches":11161,"tier":"Mid","charge":"+$4/pc","design_number":39461}]},{"id":12461,"company":"Beluga Air LLC","first":"Brian","last":"Harry","email":"brian@belugaair.com","phone":"907-235-8256","rep":"Nika Lao","tier":"Large","designs":[{"name":"Beluga Air LLC - lights, Driftwood","stitches":20466,"tier":"Large","charge":"+$10/pc","design_number":35588}]},{"id":12697,"company":"Ben Lines","first":"Patricia","last":"Click","email":"paldiva2011@gmail.com","phone":"425-336-9637","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Ben Lines","stitches":13684,"tier":"Mid","charge":"+$4/pc","design_number":39590}]},{"id":10555,"company":"Better Builders LLC","first":"Eli","last":"Hare","email":"elih@betterbuilders.com","phone":"425-233-7753","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Better Builders- with backgroud fill - darks","stitches":12836,"tier":"Mid","charge":"+$4/pc","design_number":32418},{"name":"Better Builders- with backgroud fill - lights","stitches":12836,"tier":"Mid","charge":"+$4/pc","design_number":32418}]},{"id":13301,"company":"Big Mountain Enterprise","first":"Tonya","last":"Pettit","email":"tpettit@bigmountainent.com","phone":"360-226-3049","rep":"Nika Lao","tier":"Large","designs":[{"name":"BME 4\"","stitches":15155,"tier":"Large","charge":"+$10/pc","design_number":39049}]},{"id":12006,"company":"BlackStone Construction","first":"Alisha","last":"Haugen","email":"ahagen@blackstonenw.com","phone":"360-731-4669","rep":"Nika Lao","tier":"Large","designs":[{"name":"BlackStone Construction Left Chest","stitches":20963,"tier":"Large","charge":"+$10/pc","design_number":34021}]},{"id":13319,"company":"Brett Skaloud","first":"Brett","last":"Skaloud","email":"brettskaloud@gmail.com","phone":"309-585-5681","rep":"Nika Lao","tier":"Large","designs":[{"name":"TUTHDR20","stitches":18407,"tier":"Large","charge":"+$10/pc","design_number":39145}]},{"id":13314,"company":"Brian Mankinen","first":"Brian","last":"Mankinen","email":"brianmankinen@yahoo.com","phone":"310-621-4260","rep":"Nika Lao","tier":"Large","designs":[{"name":"Branch Managers","stitches":16396,"tier":"Large","charge":"+$10/pc","design_number":39104}]},{"id":12131,"company":"Button Veterinary Hospital","first":"Danielle","last":"Jensen","email":"Djensen@buttonvet.com","phone":"253-381-4052","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Button Veterinary","stitches":13233,"tier":"Mid","charge":"+$4/pc","design_number":33672}]},{"id":13303,"company":"Carolyn Salter","first":"Carolyn","last":"Salter","email":"csalter3@gmail.com","phone":"240-674-4116","rep":"House","tier":"Large","designs":[{"name":"Testical Festival","stitches":23954,"tier":"Large","charge":"+$10/pc","design_number":39054}]},{"id":12706,"company":"Cascade Auto Glass","first":"April","last":"Baisley","email":"april.b@cascadeautoglass.com","phone":"253-208-2798","rep":"Nika Lao","tier":"Mid","designs":[{"name":"CAG logo","stitches":13072,"tier":"Mid","charge":"+$4/pc","design_number":36794}]},{"id":4077,"company":"Central Pierce County Fire & Rescue","first":"Jacob","last":"E. Weigley","email":"JWeigley@Centralpiercefire.org","phone":"253-677-0087","rep":"House","tier":"Large","designs":[{"name":"Crew 6","stitches":23490,"tier":"Large","charge":"+$10/pc","design_number":39305}]},{"id":9048,"company":"Central Wyoming Aviation","first":"Art","last":"Griffin","email":"agriffin@wyoming.com","phone":"307-858-1017","rep":"House","tier":"Large","designs":[{"name":"Central Wyoming Aviation L/C","stitches":16918,"tier":"Large","charge":"+$10/pc","design_number":20220}]},{"id":13240,"company":"Charlie Seibel","first":"Charlie","last":"Seibel","email":"cseibel@uw.edu","phone":"612-432-3856","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Voltage","stitches":10229,"tier":"Mid","charge":"+$4/pc","design_number":38853}]},{"id":12949,"company":"City Of Tacoma - Environmental Services Dept.","first":"Mike","last":"Sanders","email":"msanders2@cityoftacoma.org","phone":"253-651-3298","rep":"Nika Lao","tier":"Large","designs":[{"name":"City Of Tacoma - Environmental Compliance","stitches":15040,"tier":"Large","charge":"+$10/pc","design_number":39432}]},{"id":6428,"company":"City of Pacific","first":"Michael","last":"Rodriguez","email":"mrodiguez@ci.pacific.wa.us","phone":"253-737-6920","rep":"Nika Lao","tier":"Large","designs":[{"name":"City Of Pacific Utilities - Navy, Black, Tabacco, Estate blue, Gray","stitches":21330,"tier":"Large","charge":"+$10/pc","design_number":23245}]},{"id":6695,"company":"City of Tacoma (Facilities)","first":"Christina","last":"Finley","email":"cfinley@tacoma.gov","phone":"253-591-2034","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"City of Tacoma Facilities Square- 2025","stitches":13238,"tier":"Mid","charge":"+$4/pc","design_number":39212}]},{"id":4165,"company":"Clark-Skamania Flyfishers","first":"Don","last":"Kohler","email":"moabman07@gmail.com","phone":"503 891-5486","rep":"House","tier":"Mid","designs":[{"name":"M3962 Clark-Skamania Flyfishers - KHAKI","stitches":13590,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":1868,"company":"Combined Carriers Co.","first":"Susan","last":"Whealdon","email":"susanwhealdon@combinedcarriers.com","phone":"253-531-3300","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Combined Carriers Company Heavy Haul Puyallup, Wa - black, Navy, , Red","stitches":17829,"tier":"Large","charge":"+$10/pc","design_number":29801},{"name":"Combined Carriers Puyallup, WA","stitches":16530,"tier":"Large","charge":"+$10/pc","design_number":27756}]},{"id":13383,"company":"Coral Slater","first":"Coral","last":"Slater","email":"coralslater0345@gmail.com","phone":"253-880-4486","rep":"House","tier":"Mid","designs":[{"name":"Coral Slater","stitches":13747,"tier":"Mid","charge":"+$4/pc","design_number":39388}]},{"id":10928,"company":"Cosco Fire Protection","first":"Katie","last":"Jackson","email":"kjackson@coscofire.com","phone":"206-438-3357","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Cosco Fire - Bk/AegeanB, Black,","stitches":14340,"tier":"Mid","charge":"+$4/pc","design_number":27798}]},{"id":11824,"company":"Costco Optical Lab 190","first":"Destini","last":"Vincent","email":"destinivincent@costco.com","phone":"(253) 333-3200","rep":"Nika Lao","tier":"Large","designs":[{"name":"Continuous Improvement","stitches":21997,"tier":"Large","charge":"+$10/pc","design_number":36215}]},{"id":8672,"company":"Costco Wholesale","first":"Sergey","last":"Makeyenko","email":"d171fs06@costco.com","phone":"253-826-6504","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Costco","stitches":12979,"tier":"Mid","charge":"+$4/pc","design_number":39811}]},{"id":12624,"company":"Costco Wholesale- Salt Lake City Fleet","first":"Megan","last":"Myers","email":"d584fla@costco.com","phone":"801-333-3577","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Costco Salt Lake City - Fleet - Black","stitches":10158,"tier":"Mid","charge":"+$4/pc","design_number":36478}]},{"id":13474,"company":"Courtyard Marriott - Downtown Tacoma","first":"Debra","last":"Purcella","email":"Debra.Purcella@marriott.com","phone":"253-284-3574","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Hollander Hospitality - Navy, Black","stitches":11794,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":12913,"company":"Covington Creek Nursery","first":"Lonnie","last":"Malmassari","email":"lonniemalmal@gmail.com","phone":"253-631-5320 c","rep":"Nika Lao","tier":"Large","designs":[{"name":"Covington Creek Nursery","stitches":18646,"tier":"Large","charge":"+$10/pc","design_number":37739}]},{"id":4691,"company":"Crowley Fuels LLC","first":"Kelly","last":"Andrews","email":"Kelly.Andrews@crowley.com","phone":"907-250-7233","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Bob's 50th Anniversary Logo","stitches":10410,"tier":"Mid","charge":"+$4/pc","design_number":20864}]},{"id":3114,"company":"Daffodil Kiwanis Club","first":"Scott","last":"Thompson","email":"sgthompson56@gmail.com","phone":"253-208-4742","rep":"Nika Lao","tier":"Large","designs":[{"name":"Daffodil Kiwanis Valley Club","stitches":15858,"tier":"Large","charge":"+$10/pc","design_number":36598}]},{"id":4811,"company":"Dean's Automotive Service Center","first":"Don","last":"Stewart","email":"deansautomotive@gci.net","phone":"907-276-5760","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"02T145 Cap Dean's Automotive - Black","stitches":14225,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":12284,"company":"Diamond Concrete LLC","first":"Juan","last":"Valdez","email":"j.diamondconcretellc@gmail.com","phone":"253-353-1826","rep":"Nika Lao","tier":"Large","designs":[{"name":"Diamond Concrete LLC","stitches":15389,"tier":"Large","charge":"+$10/pc","design_number":34588}]},{"id":6777,"company":"Dick's Heating &  A/C","first":"Loretta","last":"Rhode","email":"loretta@dicksheating.com","phone":"253-531-9579","rep":"Nika Lao","tier":"Mid","designs":[{"name":"P3223, L/C Dick's Heating & A/C","stitches":11314,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":13495,"company":"Dickman-Hines Lumber Company","first":"Stephanie","last":"Dickman","email":"stephanie@dickman-hines.com","phone":"253-838-6790","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Dickman-Hines 2025 White logo","stitches":10736,"tier":"Mid","charge":"+$4/pc","design_number":39777}]},{"id":10800,"company":"Domino's - Team Seattle","first":"Kenra","last":"Keller","email":"kkeller@pnwdominos.com","phone":"360-509-0492 cell","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Domino's Big foot w/ trees","stitches":15595,"tier":"Large","charge":"+$10/pc","design_number":36978}]},{"id":12937,"company":"Domino's Be Good Pizza LLC","first":"Eric","last":"Murry","email":"emurry@bgpdominos.com","phone":"206-265-9711","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Domino's Be Good Pizza","stitches":17938,"tier":"Large","charge":"+$10/pc","design_number":39567}]},{"id":6926,"company":"Donahue Graphics","first":"Chris","last":"Donahue","email":"donahuegraphix@gmail.com","phone":"(253) 691-6847","rep":"House","tier":"Large","designs":[{"name":"Iron Age Designs","stitches":23944,"tier":"Large","charge":"+$10/pc","design_number":39757}]},{"id":7740,"company":"Drain Pro Inc.","first":"Sara","last":"Ford","email":"sara@drain-proinc.com","phone":"253-926-5586","rep":"Nika Lao","tier":"Large","designs":[{"name":"Drain-Pro","stitches":20792,"tier":"Large","charge":"+$10/pc","design_number":35430}]},{"id":13372,"company":"EMF Party Rental","first":"Carly","last":"Lenoir","email":"emfpartyrentals@gmail.com","phone":"253-797-3142","rep":"Nika Lao","tier":"Mid","designs":[{"name":"EMF Party Rentals - white","stitches":14206,"tier":"Mid","charge":"+$4/pc","design_number":39353}]},{"id":12923,"company":"Electrical Outfitters  NW","first":"Mercedez","last":"Willson","email":"mercedezw@electricaloutfittersnw.com","phone":"253-281-7516","rep":"Nika Lao","tier":"Large","designs":[{"name":"Electrical Outfitters NW","stitches":19629,"tier":"Large","charge":"+$10/pc","design_number":37813}]},{"id":13322,"company":"Elevate Home Renovations","first":"Karisa","last":"Lyons","email":"karisalyons@yahoo.com","phone":"253-709-9589","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Elevate Home Renovations","stitches":10962,"tier":"Mid","charge":"+$4/pc","design_number":39207}]},{"id":12239,"company":"Emish Market Grocery Store","first":"Viktoria","last":"Kuharchuk","email":"victoriakuharchuk@gmail.com","phone":"414-708-0008","rep":"Nika Lao","tier":"Large","designs":[{"name":"Emish Market Grocery  - Chef jacket Gray","stitches":16178,"tier":"Large","charge":"+$10/pc","design_number":34360}]},{"id":12806,"company":"Eskimos INC","first":"Payuq","last":"Ahsogeak","email":"pahsogeak@asrc.com","phone":"907-852-3835","rep":"Nika Lao","tier":"Large","designs":[{"name":"Eskimos Inc","stitches":15304,"tier":"Large","charge":"+$10/pc","design_number":39802}]},{"id":12328,"company":"Evergreen Softub","first":"Jen","last":"Hartley","email":"jennifer@evergreensoftub.com","phone":"208-818-3205","rep":"Nika Lao","tier":"Large","designs":[{"name":"Evergreen Softub & Sauna new 2023","stitches":21626,"tier":"Large","charge":"+$10/pc","design_number":34808}]},{"id":10361,"company":"Exterior Metals","first":"Ray","last":"Sanchez","email":"ray@exteriormetals.com","phone":"206-679-9599","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Exterior Metals Full Logo","stitches":10068,"tier":"Mid","charge":"+$4/pc","design_number":38315}]},{"id":12190,"company":"Facilities Partners","first":"Joe","last":"Malaspino","email":"joe.malaspino@facilitiespartners.com","phone":"Joe Malaspino","rep":"Nika Lao","tier":"Large","designs":[{"name":"Facilities Partners","stitches":17456,"tier":"Large","charge":"+$10/pc","design_number":37549}]},{"id":12199,"company":"Father Nature Landscapes of Tacoma, Inc.","first":"Jennifer","last":"Hilton","email":"tacomaoffice@fnltac.com","phone":"253-761-6437","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Father Nature Landscapes - small logo  - Polos","stitches":12763,"tier":"Mid","charge":"+$4/pc","design_number":34864}]},{"id":7836,"company":"Federal Way Police","first":"Arianna","last":"Webster","email":"Arianna.Webster@federalwaywa.gov","phone":"253-835-6749","rep":"Nika Lao","tier":"Large","designs":[{"name":"J379, L/C Federal Way Police Detective Badge","stitches":24060,"tier":"Large","charge":"+$10/pc","design_number":38165}]},{"id":12334,"company":"Fire Buffs","first":"Dave","last":"Lambing","email":"quartermaster@tacomafirebuffbattalion.org","phone":"253-778-6815","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Fire Buff (Fire Logo)","stitches":10424,"tier":"Mid","charge":"+$4/pc","design_number":36275}]},{"id":12005,"company":"Five Star Mechanical","first":"Chris","last":"Taylor","email":"christ@fivestarmech.com","phone":"206-851-9812","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Five Star Mechanical  - Work shirt","stitches":10092,"tier":"Mid","charge":"+$4/pc","design_number":33512}]},{"id":7549,"company":"Flagship Maritime Training","first":"Brad","last":"Trout","email":"director@flagshipmaritime.net","phone":"253-384-3524","rep":"House","tier":"Mid","designs":[{"name":"P5714, L/C Flagship","stitches":12446,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":12465,"company":"Frost Landscape","first":"Jeremy","last":"Hanson","email":"jeremy@frostlandscape.com","phone":"253-736-3312","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Frost Landscape (Full Logo) - white logo","stitches":14896,"tier":"Mid","charge":"+$4/pc","design_number":37651}]},{"id":6689,"company":"GA Jorgensen Co. Inc.","first":"Rowan","last":"Friday","email":"gajorgensencompany@comcast.net","phone":"253-863-0600","rep":"Nika Lao","tier":"Mid","designs":[{"name":"P3028, L/C GA Jorgenson Co. Inc.","stitches":14901,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":12850,"company":"GEC Civil Environmental Contractors","first":"Jayson","last":"Steven","email":"jayson@gecnw.com","phone":"253-606-8787","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"GEC Civil","stitches":10531,"tier":"Mid","charge":"+$4/pc","design_number":37519}]},{"id":7265,"company":"Galitelo Building Products","first":"Chrissie","last":"Galitelo","email":"galitelochrissie@gmail.com","phone":"360-438-2289","rep":"Nika Lao","tier":"Large","designs":[{"name":"P2708 L/C Galitelo  - Jacket","stitches":20155,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":5204,"company":"Gary Kolano","first":"Gary","last":"Kolano","email":"gtkolano@msn.com","phone":"253-209-5467","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Lincoln High School Alumni","stitches":13152,"tier":"Mid","charge":"+$4/pc","design_number":39849}]},{"id":12843,"company":"Gate Service and Technology","first":"Rachel","last":"Robertson","email":"rachel@teamgst.com","phone":"253-281-2504","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Team GST Big logo - Small logo Black","stitches":11108,"tier":"Mid","charge":"+$4/pc","design_number":39040}]},{"id":13577,"company":"GeauxOutdoors","first":"","last":"","email":"","phone":"","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Remora Zero","stitches":12120,"tier":"Mid","charge":"+$4/pc","design_number":40142}]},{"id":2426,"company":"General Mechanical","first":"Megan","last":"Yapp","email":"myapp@generalmechanical.com","phone":"253-627-8155","rep":"Nika Lao","tier":"Large","designs":[{"name":"GM Stacked- Silver thread","stitches":16498,"tier":"Large","charge":"+$10/pc","design_number":39202}]},{"id":11771,"company":"General Plastics Manufacturing Company","first":"Candice","last":"Smith","email":"candice_smith@generalplastics.com","phone":"253-473-5000","rep":"Nika Lao","tier":"Mid","designs":[{"name":"GP Plastic Logo","stitches":10292,"tier":"Mid","charge":"+$4/pc","design_number":38085}]},{"id":12616,"company":"Gonnason Boats","first":"Jerid","last":"Ronquillo","email":"jerid@gonnasonboats.com","phone":"253-852-5336","rep":"Nika Lao","tier":"Mid","designs":[{"name":"HERE FOR THE TOONS - PUFF logo","stitches":10747,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":12349,"company":"Grandview Early Learning Center","first":"Amanda","last":"Frueh-Dillon","email":"Amanda.Dillon@PuyallupTribe-nsn.gov","phone":"253-382-6371","rep":"Nika Lao","tier":"Both","designs":[{"name":"Grandview Early Learning Center","stitches":21768,"tier":"Large","charge":"+$10/pc","design_number":36476},{"name":"Grandview Early Learning Center","stitches":10884,"tier":"Mid","charge":"+$4/pc","design_number":38803}]},{"id":12213,"company":"Grant County Fire Dist 7 Auxillary","first":"Christopher","last":"Baker","email":"firechief@gcfd7.org","phone":"509-750-0752","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Grant Country Fire Dist 7","stitches":10086,"tier":"Mid","charge":"+$4/pc","design_number":37488}]},{"id":12658,"company":"Gravity Coffee","first":"Paige","last":"Dawes","email":"panderson@gravitycoffee.com","phone":"253-750-1571","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Gravity full logo - black","stitches":12153,"tier":"Mid","charge":"+$4/pc","design_number":38604}]},{"id":3001,"company":"Green Effects, Inc.","first":"Denny","last":"Wislocker","email":"dennyw@greeneffectsinc.com","phone":"(253)891-9888","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Green Effects","stitches":10632,"tier":"Mid","charge":"+$4/pc","design_number":36914}]},{"id":9960,"company":"Gutter Glove of Washington","first":"Steve","last":"Roskamp","email":"aboutaag@gmail.com","phone":"425-442-7634","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Gutter Glove Beanie","stitches":12654,"tier":"Mid","charge":"+$4/pc","design_number":39674}]},{"id":2729,"company":"HHJ, Inc.","first":"April","last":"Edwards","email":"April@hhjinc.com","phone":"253-922-4168","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"HHJ Architecture & Construction - charcoal Heather","stitches":15846,"tier":"Large","charge":"+$10/pc","design_number":18689}]},{"id":13367,"company":"Haberdash Home","first":"Troy","last":"Grindle","email":"troy@haberdashhome.com","phone":"206-227-4804","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Haberdash Home- Hh","stitches":15244,"tier":"Large","charge":"+$10/pc","design_number":39330}]},{"id":13579,"company":"Hayes Heating & Cooling","first":"","last":"","email":"","phone":"","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Hayes Heating (House)","stitches":18706,"tier":"Large","charge":"+$10/pc","design_number":40146}]},{"id":12920,"company":"Hearthside and Home LLC","first":"Theresa","last":"Percy","email":"hearthsideandhomellc@hotmail.com","phone":"425-771-6434","rep":"House","tier":"Mid","designs":[{"name":"Hearthside - Navy","stitches":12410,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":12466,"company":"High Country Contractor & Developers","first":"Susan","last":"Hughes","email":"susie@highcountrycontractors.com","phone":"206-255-3795","rep":"Nika Lao","tier":"Mid","designs":[{"name":"HC - Left panel  - Black","stitches":12929,"tier":"Mid","charge":"+$4/pc","design_number":35657}]},{"id":7750,"company":"Highline Community Band","first":"Lynette","last":"Ritchie","email":"osuandbeyond@gmail.com","phone":"206-650-8278","rep":"House","tier":"Mid","designs":[{"name":"Highline Community Band (2020 New Logo)","stitches":10010,"tier":"Mid","charge":"+$4/pc","design_number":32886}]},{"id":12907,"company":"Hilltop Heritage Middle School","first":"Brandon","last":"Lake","email":"bmlake95@gmail.com","phone":"214-636-7836","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Hilltop Heritage Middle School","stitches":11896,"tier":"Mid","charge":"+$4/pc","design_number":37728}]},{"id":4916,"company":"Hinshaw's Acura","first":"Arianna","last":"Bodaghi","email":"ari@hinshaws.com","phone":"253-922-8830","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Hinshaw's - Acura (2016) - Right Sleeve Darks","stitches":24295,"tier":"Large","charge":"+$10/pc","design_number":26845},{"name":"Hinshaw's - Acura (2016) - Right Sleeve Darks","stitches":15044,"tier":"Large","charge":"+$10/pc","design_number":26845}]},{"id":12343,"company":"Hollander Hospitality","first":"Angela","last":"Reudinger","email":"Facilitylead@hollanderhospitality.com","phone":"253-273-2803","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Hollander Hospitality - Navy, Black","stitches":10032,"tier":"Mid","charge":"+$4/pc","design_number":34850}]},{"id":13373,"company":"INNVOVA Architects","first":"Shiree","last":"Teixeira","email":"shiree@INNOVAarchitects.com","phone":"","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Innvova Architects","stitches":13829,"tier":"Mid","charge":"+$4/pc","design_number":39338}]},{"id":12552,"company":"Illuminate Contracting","first":"Robert","last":"Semingsen","email":"rsemingsen@comcast.net","phone":"206-571-6209","rep":"House","tier":"Mid","designs":[{"name":"Illuminate Contracting","stitches":12365,"tier":"Mid","charge":"+$4/pc","design_number":36072}]},{"id":13228,"company":"InFormula Team (exp Realty)","first":"DJ","last":"Reed","email":"reed.dj.22@gmail.com","phone":"253-709-2214","rep":"House","tier":"Large","designs":[{"name":"InFormula Team (exp Realty)","stitches":18291,"tier":"Large","charge":"+$10/pc","design_number":38817}]},{"id":550,"company":"Inderbitzin Distributors","first":"Rosa","last":"Gallagher","email":"rosag@inderbitzin.com","phone":"253-922-2592 ext306","rep":"Nika Lao","tier":"Mid","designs":[{"name":"11V497, Inderbtizin Distributors - All","stitches":14276,"tier":"Mid","charge":"+$4/pc","design_number":32648},{"name":"Summit Snacks Jerky - With no trees","stitches":12947,"tier":"Mid","charge":"+$4/pc","design_number":32648}]},{"id":12030,"company":"Infinity Fire Protection","first":"Robert","last":"Maxcy","email":"robert.maxcy@infinity-fire.com","phone":"425-445-912","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Infinity Fire Protection","stitches":16819,"tier":"Large","charge":"+$10/pc","design_number":33006}]},{"id":11476,"company":"Infinity Heating & Air","first":"Jesse","last":"Kelpszas","email":"infinityheatingac.jesse@gmail.com","phone":"253-412-0431","rep":"Nika Lao","tier":"Large","designs":[{"name":"Infinity Heating LC Logo","stitches":16244,"tier":"Large","charge":"+$10/pc","design_number":30367}]},{"id":11919,"company":"Interstate - McBee LLC","first":"Laura","last":"Andrea","email":"landreas@interstate-mcbee.com","phone":"440-903-8119","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Inter - McBee","stitches":10816,"tier":"Mid","charge":"+$4/pc","design_number":40153}]},{"id":860,"company":"JM Corp & Son Inc","first":"Chrystal","last":"Corp","email":"chrystal@jmcorpandson.com","phone":"253-845-6745","rep":"Nika Lao","tier":"Large","designs":[{"name":"P2108, Cap Schwinger / P2108B Schwinger 2007","stitches":19245,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":10963,"company":"Jacksons","first":"Jacob","last":"Brooks","email":"jacob.brooks@jacksons.com","phone":"206-552-5323","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Jacksons","stitches":10600,"tier":"Mid","charge":"+$4/pc","design_number":27963}]},{"id":13347,"company":"JamesHardie","first":"Jared","last":"Walker","email":"Jared.Walker@jameshardie.com","phone":"253-256-9178","rep":"Nika Lao","tier":"Large","designs":[{"name":"COBALT","stitches":17607,"tier":"Large","charge":"+$10/pc","design_number":39422}]},{"id":13379,"company":"Janet Zamzow","first":"Janet","last":"Zamzow","email":"janetzm@hotmail.com","phone":"253-961-3205","rep":"House","tier":"Mid","designs":[{"name":"Hummingbirds only","stitches":10633,"tier":"Mid","charge":"+$4/pc","design_number":39403}]},{"id":10433,"company":"Jet Millwork Installations","first":"Janae","last":"Cruz","email":"janae@jmisupply.com","phone":"253-200-6556","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"JZ Construction","stitches":13179,"tier":"Mid","charge":"+$4/pc","design_number":37528}]},{"id":11631,"company":"Jones Trucking","first":"Derrick","last":"Jones","email":"jonestrucking72@comcast.net","phone":"253-255-8342","rep":"Nika Lao","tier":"Large","designs":[{"name":"Jones Trucking  Cap Front - Beanies Black, Coal Heather,Heather Grey","stitches":17570,"tier":"Large","charge":"+$10/pc","design_number":32743}]},{"id":12828,"company":"Justus Mechanical LLC","first":"Carolyn","last":"Hardin","email":"carolyn@justusmechanical.com","phone":"253-202-1697","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Justus Mechanical LLC","stitches":12310,"tier":"Mid","charge":"+$4/pc","design_number":37375}]},{"id":11740,"company":"Kent East Hill Nursery","first":"Lonnie","last":"Malmassari","email":"lonniemalmal@gmail.com","phone":"253-631-5320 c","rep":"Nika Lao","tier":"Large","designs":[{"name":"Kent East Hill Nursery Apron Logo","stitches":20386,"tier":"Large","charge":"+$10/pc","design_number":31666}]},{"id":3718,"company":"Ketchikan Mechanical Inc,. Plumbing","first":"Melinda","last":"Pitcher","email":"melinda@ketchikanmechanical.com","phone":"907-225-9466","rep":"Nika Lao","tier":"Mid","designs":[{"name":"T1844 Ketchikan Mechanical - Black- Neon Yellow colorway","stitches":12201,"tier":"Mid","charge":"+$4/pc","design_number":24891}]},{"id":10420,"company":"King Conservation District","first":"Lorna","last":"Miss","email":"lorna.miss@kingcd.org","phone":"4254656971","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"KCD Cap Logo","stitches":12221,"tier":"Mid","charge":"+$4/pc","design_number":39529}]},{"id":10535,"company":"Knox Enterprises Inc. - WA","first":"Colin","last":"Parkins","email":"colin@knoxblindsanddrapery.com","phone":"253-310-2243","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Knox Enterprises","stitches":13288,"tier":"Mid","charge":"+$4/pc","design_number":26070},{"name":"Knox Enterprises  - Black, navy, Charcoal","stitches":13288,"tier":"Mid","charge":"+$4/pc","design_number":26070}]},{"id":12368,"company":"Kool It Mechanical","first":"Kris","last":"Shephard","email":"koolitmechanical@yahoo.com","phone":"253-230-5888","rep":"Nika Lao","tier":"Large","designs":[{"name":"Kool it Mechanical HVAC-R  - Grey steel w/ neon yellow","stitches":20390,"tier":"Large","charge":"+$10/pc","design_number":34979}]},{"id":8051,"company":"Korean Women's Association","first":"Don","last":"Tilley Jr.","email":"DTilley@kwacares.org","phone":"253-401-0149 C","rep":"Nika Lao","tier":"Mid","designs":[{"name":"J1095 KWA - Jacket","stitches":10305,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":6924,"company":"Lavelle Vac and Drainage","first":"Melissa","last":"Bendel","email":"office@lavellevac.com","phone":"253-815-0988","rep":"Nika Lao","tier":"Large","designs":[{"name":"P3690, LC, La Velle Vac and Drainage J133 CB - Navy, Safety yellow","stitches":21792,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":12894,"company":"Legacy Protective","first":"Jake","last":"Swenson","email":"jswenson@legacyprotective.com","phone":"206-930-7589","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Legacy Protective","stitches":14437,"tier":"Mid","charge":"+$4/pc","design_number":37685}]},{"id":13332,"company":"Lemon Squeezy","first":"David","last":"Holst","email":"davidholst@hotmail.com","phone":"","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Lemon Squeezy","stitches":10355,"tier":"Mid","charge":"+$4/pc","design_number":39218}]},{"id":13232,"company":"Linda Wood","first":"Linda","last":"Wood","email":"linda@drain-pro.com","phone":"253-241-5691","rep":"House","tier":"Large","designs":[{"name":"EEC","stitches":16334,"tier":"Large","charge":"+$10/pc","design_number":38823}]},{"id":10686,"company":"Linden Lane Apts","first":"Jess","last":"Qunell","email":"jqunell@hotmail.com","phone":"253-904-8647","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Linden Lane Apt - Direct Blue, LC, 2015, Vintage","stitches":24532,"tier":"Large","charge":"+$10/pc","design_number":26695}]},{"id":13446,"company":"Lisa Berenstein","first":"Lisa","last":"Berenstein","email":"lsbridge@gmail.com","phone":"206-948-7803","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Camp Lisa Est. 1985 (Blanket Corner)","stitches":19298,"tier":"Large","charge":"+$10/pc","design_number":39574}]},{"id":9502,"company":"Manke Family Resources, LP","first":"Gernie","last":"White","email":"gernie@mankefr.com","phone":"360-432-0160","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"L/C Manke Family Resources, LP","stitches":10837,"tier":"Mid","charge":"+$4/pc","design_number":22175}]},{"id":6498,"company":"Milgard  Manufacturing","first":"Gary","last":"Harber","email":"GaryHarber@milgard.com","phone":"253-320-4687","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Milgard - ALL Black","stitches":14296,"tier":"Mid","charge":"+$4/pc","design_number":36683},{"name":"Milgard - Carbon Heather, Black","stitches":11568,"tier":"Mid","charge":"+$4/pc","design_number":38496}]},{"id":10615,"company":"Mole Masters","first":"Chase","last":"Wadel","email":"molemasters@gmail.com","phone":"253-926-0402","rep":"Nika Lao","tier":"Large","designs":[{"name":"Mole Masters - NEW LOGO","stitches":16506,"tier":"Large","charge":"+$10/pc","design_number":38772}]},{"id":12924,"company":"Molen Oral & Implant Surgery","first":"Crystal","last":"Molen","email":"cmolen@molensurgery.com","phone":"253-470-5020","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Molen Oral & Implant Surgery","stitches":11988,"tier":"Mid","charge":"+$4/pc","design_number":37787}]},{"id":7678,"company":"Moose Radiator","first":"Dan","last":"DeBusk","email":"dande@1800radiator.com","phone":"253-922-7667","rep":"Nika Lao","tier":"Large","designs":[{"name":"Moose Radiator 1-800-Radiator & A/C","stitches":15867,"tier":"Large","charge":"+$10/pc","design_number":32442}]},{"id":10969,"company":"NAMA - North American Mining Association","first":"Jim","last":"Franklin","email":"miner_012@yahoo.com","phone":"253-820-3637","rep":"Nika Lao","tier":"Mid","designs":[{"name":"North American Miners Assoc. (NAMA)","stitches":13960,"tier":"Mid","charge":"+$4/pc","design_number":27948}]},{"id":12988,"company":"NW Chapter ATHS","first":"Tom","last":"PROIETTI","email":"truksrme@comcast.net","phone":"253-720-6928","rep":"Nika Lao","tier":"Mid","designs":[{"name":"NW Chapter ATHS","stitches":12306,"tier":"Mid","charge":"+$4/pc","design_number":38465}]},{"id":11217,"company":"NW Utility Services LLC","first":"Sheri","last":"Johnson","email":"sheri@puie.com","phone":"253-891-7802","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"PSE Service Partner","stitches":12538,"tier":"Mid","charge":"+$4/pc","design_number":37207}]},{"id":10551,"company":"Nisqually Lodge","first":"Ron","last":"Francis","email":"ronndogg@comcast.net","phone":"253-441-5961","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"CAP - Pacific Harbor Council","stitches":12437,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":2409,"company":"NorPac, Inc.","first":"Brian","last":"Botts","email":"brian@norpacinc.com","phone":"253-831-9065","rep":"Nika Lao","tier":"Mid","designs":[{"name":"NorPac - Med Blue w/ white","stitches":11162,"tier":"Mid","charge":"+$4/pc","design_number":36324}]},{"id":9205,"company":"Northwest Gourmet Food Products Inc.","first":"Krista","last":"Gilroy","email":"krista@nwgourmetfoods.net","phone":"253-906-3190","rep":"Nika Lao","tier":"Large","designs":[{"name":"L/C Northwest Gourmet Food Products - Char Hthr , Deep Berry","stitches":20816,"tier":"Large","charge":"+$10/pc","design_number":21063}]},{"id":13502,"company":"Northwest Handling Systems","first":"Matt","last":"Franck","email":"mattf@nwhs.com","phone":"425-255-0500","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Northwest Handling Embroidery","stitches":11205,"tier":"Mid","charge":"+$4/pc","design_number":39813}]},{"id":12523,"company":"Oak Harbor Freight Lines, Inc","first":"Kerry","last":"Millikin","email":"Kerry.Millikin@oakh.com","phone":"425-922-9537","rep":"Nika Lao","tier":"Large","designs":[{"name":"Oak Harbor University (L.E.A.D) 2.25\" - Black","stitches":19461,"tier":"Large","charge":"+$10/pc","design_number":36800}]},{"id":8661,"company":"Okanogan County Fire District #6","first":"Rusty","last":"Stamps","email":"rstamps@okanogancountyfd6.com","phone":"509-679-0345","rep":"Nika Lao","tier":"Large","designs":[{"name":"Okanogan County Fire District 6 - LC Logo","stitches":22469,"tier":"Large","charge":"+$10/pc","design_number":18947}]},{"id":2136,"company":"Old Cannery Furniture","first":"Heather","last":"Smith","email":"hsmith@oldcannery.com","phone":"253-863-0422 ext. 182","rep":"Taneisha Clark","tier":"Both","designs":[{"name":"Daffodil Festival","stitches":20987,"tier":"Large","charge":"+$10/pc","design_number":34212},{"name":"Old Cannery- Furniture Warehouse","stitches":12021,"tier":"Mid","charge":"+$4/pc","design_number":28817}]},{"id":2633,"company":"Olympic Pipeline","first":"Chris","last":"Anderson","email":"don.anderson@bp.com","phone":"206-786-0658","rep":"Nika Lao","tier":"Mid","designs":[{"name":"811 Logo 2\" High","stitches":12480,"tier":"Mid","charge":"+$4/pc","design_number":40084}]},{"id":13362,"company":"Osborn Concrete & Consulting LLC","first":"Jeremy","last":"Osborn","email":"josborncc@gmail.com","phone":"253-548-5045","rep":"Nika Lao","tier":"Large","designs":[{"name":"OSBORN CONCRETE & CONSULTING - Letter match the back,  Multicam Tropic/Loden","stitches":21508,"tier":"Large","charge":"+$10/pc","design_number":38266}]},{"id":8045,"company":"PICK-QUICK Operating Company LLC","first":"Janice","last":"Herron","email":"jherron@icon.com","phone":"253-831-6173","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"J1152, L/C, Pick Quick Drive Thru","stitches":18213,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":9058,"company":"PLU Campus Safety","first":"Lisa","last":"Trahan","email":"lisa.trahan@plu.edu","phone":"253-535-7441","rep":"Nika Lao","tier":"Mid","designs":[{"name":"PLU Campus Safety","stitches":10948,"tier":"Mid","charge":"+$4/pc","design_number":36158}]},{"id":10784,"company":"PSF Mechanical Inc","first":"Michelle","last":"Besagno","email":"mbesagno@psfmech.com","phone":"206-549-8440","rep":"Nika Lao","tier":"Mid","designs":[{"name":"PSF Cap Logo","stitches":10058,"tier":"Mid","charge":"+$4/pc","design_number":26859}]},{"id":9747,"company":"Pacific Fluids, LLC.","first":"Cassie","last":"Passmore","email":"cassieP@pacfluids.com","phone":"253-227-6585","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Left Chest: Pacific Fluids, LLC.","stitches":14202,"tier":"Mid","charge":"+$4/pc","design_number":23039}]},{"id":13531,"company":"Pacific Peak Overland","first":"Brian","last":"Lowen","email":"brianlowen@pacificpeakoverland.com","phone":"(248) 396-2148","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Pacific Peak Overland White PUFF","stitches":17766,"tier":"Large","charge":"+$10/pc","design_number":39992}]},{"id":13512,"company":"Pacific Rim Environmental Inc","first":"Tricia","last":"Lewis","email":"tlewis@pacrimenv.com","phone":"206-244-8965","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Pacific Rim","stitches":17078,"tier":"Large","charge":"+$10/pc","design_number":39882}]},{"id":12161,"company":"Paradigm Building Contractors","first":"Monica","last":"De La Torre","email":"mdelatorre@pbcontractors.net","phone":"253-246-7835","rep":"Nika Lao","tier":"Large","designs":[{"name":"PBC Contractors","stitches":19230,"tier":"Large","charge":"+$10/pc","design_number":39091}]},{"id":2685,"company":"Patriot Metal Finishing Systems","first":"Susan","last":"DeVries","email":"sdevries@patriotmfs.com","phone":"315-589-8647","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Patriot Metal Finishing Flag in Circle. LC - Lights","stitches":13024,"tier":"Mid","charge":"+$4/pc","design_number":31134}]},{"id":7398,"company":"Pierce Co. Sheriff - South Hill Precinct","first":"Rachel","last":"Olson","email":"rachel.olson@piercecountywa.gov","phone":"253-798-3901","rep":"Taneisha Clark","tier":"Both","designs":[{"name":"P905 , Mountain Detachment","stitches":15436,"tier":"Large","charge":"+$10/pc","design_number":null},{"name":"Pierce County Mt Detachment","stitches":12571,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":11430,"company":"Pierce County Emergency Management","first":"Silvia","last":"Lansburg","email":"silvia.lansburg@piercecountywa.gov","phone":"253-798-2216","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Pierce County Emergency Management - Royal","stitches":15848,"tier":"Large","charge":"+$10/pc","design_number":37406}]},{"id":13120,"company":"Pierce County Incident Management Team","first":"Kirstin","last":"Hofmann","email":"khofmann@puyallupwa.gov","phone":"253-841-5400","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Pierce County Incident Management Team","stitches":17110,"tier":"Large","charge":"+$10/pc","design_number":29831}]},{"id":6434,"company":"Pierce County Sheriff's - Foothills","first":"Ernest","last":"Cedillo","email":"ernestcedillo@gmail.com","phone":"360-470-9411","rep":"Nika Lao","tier":"Mid","designs":[{"name":"P2239 Foothills detachment","stitches":13663,"tier":"Mid","charge":"+$4/pc","design_number":14805}]},{"id":2823,"company":"Pierce County Sheriff's Department","first":"","last":"","email":"","phone":"","rep":"House","tier":"Mid","designs":[{"name":"Badge Only - Black, Charcoal","stitches":14758,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":4777,"company":"Pierce County Sheriff's Department","first":"Kevin","last":"Pressel","email":"kevin.pressel@piercecountywa.gov","phone":"Main (253) 798-8947","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Badge Only - Black, Charcoal","stitches":14758,"tier":"Mid","charge":"+$4/pc","design_number":32351}]},{"id":13296,"company":"Pierce County Sheriff- Peninsula Detachment","first":"Micha","last":"Lundborg","email":"micah.lundborg@piercecountywa.gov","phone":"253-798-3859","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Peninsula Detachment","stitches":13291,"tier":"Mid","charge":"+$4/pc","design_number":39036}]},{"id":13567,"company":"Pierce Roof Pros","first":"","last":"","email":"","phone":"","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"IKO","stitches":20461,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":12899,"company":"Port Of Seattle - Aviation Sec Dept.","first":"Tony","last":"McKenna","email":"Mckenna.T@portseattle.org","phone":"206-739-6685","rep":"Nika Lao","tier":"Large","designs":[{"name":"Stopwatch","stitches":18322,"tier":"Large","charge":"+$10/pc","design_number":39581}]},{"id":13183,"company":"Potelco, Inc.","first":"Maddie","last":"Miller","email":"MMMiller@Potelco.net","phone":"253-337-1850","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Infrasource","stitches":11558,"tier":"Mid","charge":"+$4/pc","design_number":38710},{"name":"Infrasource","stitches":10030,"tier":"Mid","charge":"+$4/pc","design_number":38710}]},{"id":8018,"company":"Power Science Engineering LLC","first":"Mary","last":"Sankaran","email":"mary@power-sci.com","phone":"206-265-1570","rep":"Nika Lao","tier":"Large","designs":[{"name":"PSE LLC - Lights , SHADOW, NEWPORT","stitches":16038,"tier":"Large","charge":"+$10/pc","design_number":28263}]},{"id":12228,"company":"Pro Paint Solutions","first":"Jennie","last":"Fenton","email":"jennief@propaintsolutions.com","phone":"206-743-6664","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Workglue","stitches":14310,"tier":"Mid","charge":"+$4/pc","design_number":40175}]},{"id":10899,"company":"Promise Breaker","first":"Dan","last":"Opitz","email":"pardanme21@gmail.com","phone":"253-208-2392","rep":"House","tier":"Large","designs":[{"name":"Promise Breaker","stitches":17131,"tier":"Large","charge":"+$10/pc","design_number":39452}]},{"id":10292,"company":"Puget Sound Antique Airplane Club","first":"Lyle","last":"Sindlinger","email":"lsindlinger@hotmail.com","phone":"253-380-8992","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Air Tour 2025","stitches":13548,"tier":"Mid","charge":"+$4/pc","design_number":25869}]},{"id":12445,"company":"Puyallup Bark Supply","first":"Savannah","last":"Sunier","email":"puyallup.bark@gmail.com","phone":"253-548-3000","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Puyallup Bark Supply","stitches":12628,"tier":"Mid","charge":"+$4/pc","design_number":36519}]},{"id":315,"company":"Puyallup High School","first":"Renee","last":"Markey","email":"MarkeRE@puyallupsd.org","phone":"360-593-1188","rep":"Nika Lao","tier":"Mid","designs":[{"name":"VIKING KNIGHTS AND LADIES","stitches":10530,"tier":"Mid","charge":"+$4/pc","design_number":34930}]},{"id":7421,"company":"Puyallup Tribal Housing","first":"Suzanne","last":"Sailto","email":"suzanne.sailto@puyalluptribe-nsn.gov","phone":"253-778-9825","rep":"Nika Lao","tier":"Large","designs":[{"name":"Puyallup Tribal Housing  - Black","stitches":16175,"tier":"Large","charge":"+$10/pc","design_number":36021}]},{"id":10216,"company":"Puyallup Tribe - Elder Dept","first":"Shantrell","last":"McCloud","email":"shanetrell.mccloud-lacroix@puyalluptribe-nsn.gov","phone":"253-680-5483","rep":"Nika Lao","tier":"Large","designs":[{"name":"L/C Logo - Puyallup Tribe Elders Dept","stitches":16342,"tier":"Large","charge":"+$10/pc","design_number":24596}]},{"id":8745,"company":"Quick & Clear","first":"Gregg","last":"Ripley","email":"gregg@quickandclearservices.com","phone":"253-848-3919","rep":"House","tier":"Mid","designs":[{"name":"Quick & Clear Logo 2.5 Inch - Graphite, Anthracite,HtdForGrn,Hthr Navy,Midnight Navy","stitches":10816,"tier":"Mid","charge":"+$4/pc","design_number":32872}]},{"id":9726,"company":"Quiet Bird Man Seattle Hangar","first":"Lyle","last":"Sindlinger","email":"lsindlinger@hotmail.com","phone":"253-380-8992","rep":"Nika Lao","tier":"Large","designs":[{"name":"QB Reunion 2023","stitches":18550,"tier":"Large","charge":"+$10/pc","design_number":36031}]},{"id":13167,"company":"R Transport","first":"James","last":"Lucich","email":"jameslucich@veneerchip.com","phone":"253-922-1911","rep":"Nika Lao","tier":"Mid","designs":[{"name":"R Transport  - Graphite w/ white","stitches":11872,"tier":"Mid","charge":"+$4/pc","design_number":38399}]},{"id":13043,"company":"RS Lending","first":"Arianna","last":"Bodaghi Bigelow","email":"aribodaghi@gmail.com","phone":"253-222-3595","rep":"Nika Lao","tier":"Mid","designs":[{"name":"RS Lending - NEW LOGO","stitches":12692,"tier":"Mid","charge":"+$4/pc","design_number":38257}]},{"id":12646,"company":"Rainier Division Fab Shop","first":"Travis","last":"Harvey","email":"Travis.Harvey@WasteConnections.com","phone":"253-281-9799","rep":"Nika Lao","tier":"Large","designs":[{"name":"Rainier Division Fab Shop","stitches":16711,"tier":"Large","charge":"+$10/pc","design_number":36580},{"name":"Rainier Division Fab Shop   - NAVY","stitches":16711,"tier":"Large","charge":"+$10/pc","design_number":36580}]},{"id":13318,"company":"Rainier Family Wealth","first":"Jun","last":"Chea","email":"jun@rainierfw.com","phone":"253-973-7744","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Rainer Family Wealth","stitches":11769,"tier":"Mid","charge":"+$4/pc","design_number":39134}]},{"id":12998,"company":"Rainier View Rooter","first":"Renee","last":"Jones","email":"Renee@rainierviewrooter.com","phone":"253-435-1996","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Rainier View Rooter","stitches":13724,"tier":"Mid","charge":"+$4/pc","design_number":38131}]},{"id":13393,"company":"Realfine Painting","first":"Mark","last":"Jensen","email":"mark@realfinepainting.com","phone":"253-352-2623","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Realfine Painting","stitches":11704,"tier":"Mid","charge":"+$4/pc","design_number":39418}]},{"id":13375,"company":"Region 6 Systems Integration","first":"Brianna","last":"Gillespie","email":"Brianna@region6.systems","phone":"253-222-2382","rep":"Nika Lao","tier":"Mid","designs":[{"name":"R-6 Systems Integration","stitches":10269,"tier":"Mid","charge":"+$4/pc","design_number":39855}]},{"id":10802,"company":"Ridgeline Landscape","first":"Carol","last":"Frank","email":"carol@ridgelinelandscapeservices.com","phone":"425-681-6081","rep":"House","tier":"Mid","designs":[{"name":"Ridgeline Landscape - woodland , Mossy Oak","stitches":14885,"tier":"Mid","charge":"+$4/pc","design_number":27137}]},{"id":12547,"company":"Roto-Rooter Services Co  (California)","first":"Peter","last":"Knoebel","email":"peter.knoebel@rrsc.com","phone":"650-642-6094","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"2018 Roto Rooter- Plumbing and Water Cleanup","stitches":10692,"tier":"Mid","charge":"+$4/pc","design_number":31105}]},{"id":13406,"company":"Royal Cabinets Inc.","first":"Kay","last":"Chase","email":"kay@royalcabinetsinc.com","phone":"253-888-5723","rep":"Nika Lao","tier":"Large","designs":[{"name":"Royal Cabinet Inc.","stitches":24062,"tier":"Large","charge":"+$10/pc","design_number":39478}]},{"id":13300,"company":"SV Shotcrete","first":"Micah","last":"Silberman","email":"micahsilberman@svshotcrete.onmicrosoft.com","phone":"206-396-5456","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"SV Shotcrete","stitches":18550,"tier":"Large","charge":"+$10/pc","design_number":39110}]},{"id":415,"company":"Sea Scout Ship","first":"Tom","last":"Rogers","email":"tomrogers@cbmsi.com","phone":"253-572-2666","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Charles N. Curtis, Sea Scout Ship 110","stitches":11156,"tier":"Mid","charge":"+$4/pc","design_number":35620}]},{"id":12860,"company":"Seattle Colleges","first":"Janae","last":"Vieira","email":"janae.vieira@gmail.com","phone":"206-963-0059","rep":"Nika Lao","tier":"Large","designs":[{"name":"Seattle Central College","stitches":16366,"tier":"Large","charge":"+$10/pc","design_number":37916}]},{"id":13317,"company":"SideOut Tsunami","first":"Rhona","last":"Seng","email":"rhona@sideouttsunami.com","phone":"206-913-3131","rep":"Nika Lao","tier":"Mid","designs":[{"name":"SideOut Tsunami  4.5 wide","stitches":12049,"tier":"Mid","charge":"+$4/pc","design_number":39132}]},{"id":13032,"company":"Sister Cities International","first":"Jeff","last":"Mincheff","email":"jeffmincheff@gmail.com","phone":"503-330-7770","rep":"Nika Lao","tier":"Large","designs":[{"name":"Chippewa Boat Puff no bottom text","stitches":16437,"tier":"Large","charge":"+$10/pc","design_number":38234}]},{"id":2909,"company":"Sitka Harbor Dept","first":"Mark","last":"Hodges","email":"mark.hodges@cityofsitka.org","phone":"907-747-4015","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Sitka Harbor Department","stitches":14889,"tier":"Mid","charge":"+$4/pc","design_number":21405}]},{"id":6081,"company":"Sitka Point Charters","first":"Mike","last":"Boles","email":"sitkapointlodge@gmail.com","phone":"(888) 747-7406","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Sitka Point Lodge - ALL Colors","stitches":22893,"tier":"Large","charge":"+$10/pc","design_number":25887}]},{"id":4326,"company":"Ski Inn Sports Bar","first":"Mike","last":"Walenceus","email":"mwalenceus@comcast.net","phone":"253-569-1802","rep":"House","tier":"Mid","designs":[{"name":"Ski Inn (larger logo)","stitches":12286,"tier":"Mid","charge":"+$4/pc","design_number":28394}]},{"id":11714,"company":"Skunk Work Robotics Booster Club","first":"Amie","last":"Fisher","email":"amie.fisher@skunkworks1983.com","phone":"206-818-6851","rep":"Nika Lao","tier":"Large","designs":[{"name":"Skunkworks Logo - BLACK, Black/Iron Gray, Black/Red","stitches":15745,"tier":"Large","charge":"+$10/pc","design_number":31535}]},{"id":13216,"company":"Skyline Properties Inc","first":"Eleanor","last":"Merwin","email":"exmerwin@gmail.com","phone":"206-458-0397","rep":"Nika Lao","tier":"Large","designs":[{"name":"Skyline Properties","stitches":16724,"tier":"Large","charge":"+$10/pc","design_number":38779}]},{"id":8109,"company":"Smokin' Kue / A.P.A","first":"Michelle","last":"Barkdoll","email":"SmokinKue@comcast.net","phone":"253-219-2130","rep":"Nika Lao","tier":"Mid","designs":[{"name":"1,000 Matches Played","stitches":11404,"tier":"Mid","charge":"+$4/pc","design_number":34743}]},{"id":7204,"company":"Steilacoom History Museum Association","first":"Marianne","last":"Bull","email":"mariannebull7@gmail.com","phone":"253-209-5396","rep":"House","tier":"Mid","designs":[{"name":"Steilacoom - Hunter Green- Sand Dune Thread","stitches":10154,"tier":"Mid","charge":"+$4/pc","design_number":25478}]},{"id":13402,"company":"Steilacoom Kiwanis","first":"Scott","last":"Johnson","email":"skjohnson1222@gmail.com","phone":"8475087063","rep":"Nika Lao","tier":"Large","designs":[{"name":"Steilacoom Kiwanis - High School Key Club","stitches":24451,"tier":"Large","charge":"+$10/pc","design_number":39860},{"name":"Steilacoom Kiwanis","stitches":17998,"tier":"Large","charge":"+$10/pc","design_number":39458}]},{"id":12007,"company":"Stella Jones","first":"Christina","last":"Dana","email":"cdeboer@stella-jones.com","phone":"253-306-1716","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Utility Pole- Quality Assurance","stitches":13574,"tier":"Mid","charge":"+$4/pc","design_number":37838}]},{"id":1865,"company":"Sterino Farms","first":"","last":"","email":"","phone":"","rep":"House","tier":"Both","designs":[{"name":"Sterino Farms - Apron","stitches":21119,"tier":"Large","charge":"+$10/pc","design_number":null},{"name":"Sterino Farms","stitches":13550,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":11911,"company":"Sterino Farms","first":"Karyn","last":"Sterino","email":"ksterino@aol.com","phone":"253-241-1698","rep":"Nika Lao","tier":"Both","designs":[{"name":"Sterino Farms - Apron","stitches":21119,"tier":"Large","charge":"+$10/pc","design_number":38773},{"name":"Sterino Farms","stitches":13550,"tier":"Mid","charge":"+$4/pc","design_number":38773}]},{"id":12678,"company":"Streamline General Construction","first":"Shelby","last":"Traverso","email":"shelby@streamlinegeneral.com","phone":"","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Streamline Construction - Grey/Graphite,Charcoal","stitches":10694,"tier":"Mid","charge":"+$4/pc","design_number":36702}]},{"id":4253,"company":"Streich Bros. Inc.","first":"Corrie","last":"Marston","email":"office@streichbros.com","phone":"253-383-1491","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Streich Brothers 68th Anniversary","stitches":10104,"tier":"Mid","charge":"+$4/pc","design_number":39783}]},{"id":7932,"company":"Submarine Veterans of America","first":"John","last":"Riley","email":"jprjer@sbcglobal.net","phone":"203-668-9131","rep":"House","tier":"Large","designs":[{"name":"P267 Honorary Submariner","stitches":15276,"tier":"Large","charge":"+$10/pc","design_number":32341}]},{"id":8068,"company":"Submarine Vets Denizens of the Deep","first":"Robert(Bob)","last":"Kinney","email":"rlkinney@nu-z.net","phone":"706-401-1323","rep":"House","tier":"Large","designs":[{"name":"P267 Honorary Submariner","stitches":15276,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":11095,"company":"Surfbird","first":"Nell","last":"Loney","email":"nell@mysurfbird.com","phone":"808-635-4148","rep":"Nika Lao","tier":"Large","designs":[{"name":"Surfbird Text Only","stitches":21878,"tier":"Large","charge":"+$10/pc","design_number":28802}]},{"id":13377,"company":"TT & T Contractor","first":"Winston","last":"","email":"twhavili2@gmail.com","phone":"206-550-1867","rep":"Nika Lao","tier":"Large","designs":[{"name":"TT & T Contractor","stitches":20048,"tier":"Large","charge":"+$10/pc","design_number":39367}]},{"id":13359,"company":"Tacoma Garden Club","first":"Susan","last":"Pittman","email":"susanpittman@me.com","phone":"206-931-2518","rep":"House","tier":"Large","designs":[{"name":"TGC  - Hunter","stitches":16316,"tier":"Large","charge":"+$10/pc","design_number":39329}]},{"id":10428,"company":"Tacoma Longshoremen Credit Union","first":"Bill","last":"Syrovatka","email":"vatka10@gmail.com","phone":"253-279-7755","rep":"Nika Lao","tier":"Large","designs":[{"name":"TLCU - Navy, Moonlight Blue, Black","stitches":21024,"tier":"Large","charge":"+$10/pc","design_number":25828},{"name":"ILWU 23","stitches":17246,"tier":"Large","charge":"+$10/pc","design_number":39194}]},{"id":12600,"company":"Tacoma Public Schools","first":"Cheri","last":"Ashbaugh","email":"cashbau@Tacoma.K12.Wa.US","phone":"253-571-1255","rep":"Nika Lao","tier":"Large","designs":[{"name":"Tacoma Public School Campus Security","stitches":17186,"tier":"Large","charge":"+$10/pc","design_number":36344}]},{"id":3790,"company":"Tacoma Rose Society","first":"Anna Maria","last":"Tallariti","email":"amtallariti@gmail.com","phone":"","rep":"House","tier":"Mid","designs":[{"name":"Tacoma Rose Society Caps - Cap","stitches":13939,"tier":"Mid","charge":"+$4/pc","design_number":22351}]},{"id":534,"company":"Tacoma Yacht Club","first":"Annette","last":"Mummery","email":"annette.mummery@gmail.com","phone":"(253) 278-9346","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"2025 Daffodil Marine Festival","stitches":14427,"tier":"Mid","charge":"+$4/pc","design_number":38619}]},{"id":10720,"company":"Team Cozzi Foundation","first":"Cyndi","last":"Cozzi","email":"cmcozzi@comcast.net","phone":"253-261-8239","rep":"House","tier":"Mid","designs":[{"name":"Team Cozzi - Golf 2 Cure  - Black, Navy, Deep Smoke, Gear Gray","stitches":10700,"tier":"Mid","charge":"+$4/pc","design_number":36992}]},{"id":12993,"company":"Terenn Houk","first":"Terenn","last":"Houk","email":"terenn.houk@gmail.com","phone":"360-761-8217","rep":"Nika Lao","tier":"Mid","designs":[{"name":"SFD","stitches":11057,"tier":"Mid","charge":"+$4/pc","design_number":38920}]},{"id":4330,"company":"The City of Milton","first":"Angelie","last":"Stahlnecker","email":"astahlnecker@cityofmilton.net","phone":"253-517-2701","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"City of Milton- Grey","stitches":15187,"tier":"Large","charge":"+$10/pc","design_number":35107}]},{"id":13525,"company":"The Puyallup Wedding Show","first":"Travis","last":"Engelhart","email":"travis@puyallupweddingshow.com","phone":"253-948-5900","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"The Puyallup Wedding Show LC","stitches":13020,"tier":"Mid","charge":"+$4/pc","design_number":39973}]},{"id":6942,"company":"The Roof Medic","first":"Joe","last":"Conant","email":"joe@yourroofmedic.com","phone":"253-315-9658","rep":"Nika Lao","tier":"Large","designs":[{"name":"The Roof Medic","stitches":24449,"tier":"Large","charge":"+$10/pc","design_number":21880}]},{"id":12641,"company":"Total Property Services","first":"Kelly","last":"Dixon","email":"kelly@totalpropertyservices.us","phone":"253-537-3737","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Total Property Services - 3\"","stitches":23541,"tier":"Large","charge":"+$10/pc","design_number":37942}]},{"id":13137,"company":"Town And County Auto Repair","first":"Bruce","last":"Muhleman","email":"townandcountryauto@hotmail.com","phone":"360-620-5369","rep":"Nika Lao","tier":"Large","designs":[{"name":"Town And County Auto Repair","stitches":21951,"tier":"Large","charge":"+$10/pc","design_number":39770}]},{"id":10690,"company":"Trinity Construction Solution Services, LLC","first":"Ignacio","last":"Soria","email":"tcservices45@gmail.com","phone":"425-362-9836","rep":"House","tier":"Mid","designs":[{"name":"Trinity Construction Solution Services, LLC - tour blue","stitches":12658,"tier":"Mid","charge":"+$4/pc","design_number":28829}]},{"id":11870,"company":"Troop 222","first":"Sammie","last":"Loopie","email":"samiebarnard@gmail.com","phone":"253-380-9917","rep":"Nika Lao","tier":"Large","designs":[{"name":"Troop 222 WA MAP","stitches":19094,"tier":"Large","charge":"+$10/pc","design_number":37655}]},{"id":13345,"company":"Tufts Doctor Of Physical Therapy Program - Seattle","first":"Paige","last":"Osullivan","email":"Paige.Osullivan@tufts.edu","phone":"805-400-8565","rep":"Nika Lao","tier":"Both","designs":[{"name":"Tufts Doctor of Physical Therapy LC","stitches":20623,"tier":"Large","charge":"+$10/pc","design_number":39233},{"name":"Tufts Doctor of Physical Therapy LC","stitches":14863,"tier":"Mid","charge":"+$4/pc","design_number":39233}]},{"id":13113,"company":"U-Haul Company of South Puget Sound","first":"Nicole","last":"Galarneau","email":"nicole_galarneau@uhaul.com","phone":"","rep":"House","tier":"Mid","designs":[{"name":"Fife You Store It Logo - Darks, Black, Dark Brown","stitches":11198,"tier":"Mid","charge":"+$4/pc","design_number":38456}]},{"id":13344,"company":"UW - School Of Medicine","first":"Rhonda","last":"H. Osman","email":"osmanrho@uw.edu","phone":"","rep":"Nika Lao","tier":"Large","designs":[{"name":"UW - School Of Medicine Husky","stitches":20705,"tier":"Large","charge":"+$10/pc","design_number":39238}]},{"id":13571,"company":"UW Emergency Medical Services","first":"","last":"","email":"","phone":"","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"UW EMS Sleeve Logo","stitches":23844,"tier":"Large","charge":"+$10/pc","design_number":40119}]},{"id":6218,"company":"Vadis","first":"Jed","last":"Rains","email":"jed.rains@vadis.org","phone":"253-863-5173 ex314","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Vadis Lion","stitches":11328,"tier":"Mid","charge":"+$4/pc","design_number":38735}]},{"id":12586,"company":"Valley Property Services","first":"Danielle","last":"Taylor","email":"danielle@valleypropertyservices.net","phone":"425-224-8685","rep":"Nika Lao","tier":"Mid","designs":[{"name":"VPS - Valley Property Services  - Hthr Grey/Blk","stitches":14632,"tier":"Mid","charge":"+$4/pc","design_number":36268}]},{"id":11591,"company":"Valley Recycling","first":"Angie","last":"Lee","email":"angie@rustyrackguys.com","phone":"253-249-7111","rep":"Nika Lao","tier":"Large","designs":[{"name":"Valley Recycling - right side Cap - VR","stitches":23118,"tier":"Large","charge":"+$10/pc","design_number":30949}]},{"id":13254,"company":"Valley Water District","first":"Sharon","last":"Stark","email":"sharon@valleywaterdistrict.com","phone":"253-841-9698","rep":"Nika Lao","tier":"Large","designs":[{"name":"Valley Water District","stitches":16239,"tier":"Large","charge":"+$10/pc","design_number":38957}]},{"id":12986,"company":"Vector Electrical Group","first":"Ryan","last":"Bell","email":"rbell@vectorelectricalgroup.com","phone":"360-265-8583","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Vector Electrical Group","stitches":11530,"tier":"Mid","charge":"+$4/pc","design_number":40171}]},{"id":12020,"company":"Vermeer Mountain West","first":"Tim","last":"Weaver","email":"tim.weaver@vermeermw.com","phone":"253-677-9817","rep":"Nika Lao","tier":"Mid","designs":[{"name":"R Directional/Vermeer","stitches":10722,"tier":"Mid","charge":"+$4/pc","design_number":39065}]},{"id":13229,"company":"WA Small-scale Miner's Action Group","first":"Dennis","last":"Peterson","email":"pete_n_Gwen@comcast.com","phone":"253-848-8112","rep":"Nika Lao","tier":"Large","designs":[{"name":"WA Small-Scale Miner's Action Group","stitches":15220,"tier":"Large","charge":"+$10/pc","design_number":38820}]},{"id":13557,"company":"WOSSA","first":"Andrea","last":"Dodson Riley","email":"andrea@wossa.org","phone":"253-770-6594","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"WOSSA","stitches":11757,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":13262,"company":"WSU Institute of Material Research","first":"Rebecca","last":"Huffman","email":"rebecca.huffman@wsu.edu","phone":"509-335-6225","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"IMR- Institute of Materials Research","stitches":10519,"tier":"Mid","charge":"+$4/pc","design_number":38927}]},{"id":9364,"company":"WSU Master Gardner","first":"Deanne Tracy","last":"Shier","email":"dtslmt@live.com","phone":"253-227-6688","rep":"House","tier":"Large","designs":[{"name":"M4208 L/C WSU Master Gardener","stitches":15115,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":11335,"company":"Washington Restorer","first":"Alex","last":"Sitnik","email":"claims@washingtonrestorerllc.com","phone":"425-308-8322","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Washington Restorer 2021 Logo","stitches":12444,"tier":"Mid","charge":"+$4/pc","design_number":null}]},{"id":11233,"company":"Watts Process Machinery","first":"Katie","last":"Bragg","email":"katiec@wattsmachinery.com","phone":"253-770-4858","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Watts- Cap Front","stitches":10105,"tier":"Mid","charge":"+$4/pc","design_number":29176}]},{"id":8469,"company":"Wescraft RV & Truck In Fife","first":"Kandis","last":"Chadwick","email":"bookkeeping@wescraft.repair","phone":"253-926-3443","rep":"Nika Lao","tier":"Large","designs":[{"name":"L1057, L/C, Wescraft RV & Truck - Black, Forest, Hunter","stitches":15120,"tier":"Large","charge":"+$10/pc","design_number":18353}]},{"id":13430,"company":"West Coast Lighting Supply","first":"Ryan","last":"Heron","email":"ryan@pnwenergygroup.com","phone":"425-780-9244","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"PNW Energy Group","stitches":16109,"tier":"Large","charge":"+$10/pc","design_number":null}]},{"id":5246,"company":"Western Cascade Fruit Society","first":"Bill","last":"Horn","email":"hornbill66@msn.com","phone":"253-770-0485","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"TAHOMA","stitches":13602,"tier":"Mid","charge":"+$4/pc","design_number":30735}]},{"id":11360,"company":"Western Wood Preserving Company","first":"Jeff","last":"Peterson","email":"jeffp@westernwoodpreserving.com","phone":"253-863-8191","rep":"Taneisha Clark","tier":"Mid","designs":[{"name":"Western Wood Preserving Co. - Multicam Tropic/Loden","stitches":10036,"tier":"Mid","charge":"+$4/pc","design_number":29755}]},{"id":12585,"company":"White Wolf Express LLC","first":"Andres","last":"Mauricio","email":"whitewolfexp@gmail.com","phone":"253-353-0667","rep":"Nika Lao","tier":"Mid","designs":[{"name":"White Wolf Express New Logo","stitches":10690,"tier":"Mid","charge":"+$4/pc","design_number":37663}]},{"id":13260,"company":"Wood and Stoane","first":"Dina","last":"Loudenslager","email":"dina@woodandstoane.com","phone":"612-900-5255","rep":"Taneisha Clark","tier":"Large","designs":[{"name":"Wood and Stoane New EMB 2025","stitches":22609,"tier":"Large","charge":"+$10/pc","design_number":39823},{"name":"Garage Shop/Wood & Stoane/Carter","stitches":19887,"tier":"Large","charge":"+$10/pc","design_number":38947}]},{"id":9931,"company":"Yorker Electric & Service LLC","first":"Tracy","last":"Yorker","email":"yorkrtl@gmail.com","phone":"c253-778-5204","rep":"Nika Lao","tier":"Large","designs":[{"name":"Yorker Electric- No phone number","stitches":22542,"tier":"Large","charge":"+$10/pc","design_number":33773}]},{"id":13346,"company":"ZEHNERGY ELECTRIC LLC","first":"Amy","last":"Zehner","email":"zehnergyelectric@gmail.com","phone":"253-470-0974","rep":"Nika Lao","tier":"Mid","designs":[{"name":"Zehnergy Electric","stitches":11160,"tier":"Mid","charge":"+$4/pc","design_number":39230}]},{"id":12758,"company":"lululemon","first":"Holly","last":"Yoon","email":"hyoon@lululemon.com","phone":"425-478-8479","rep":"Nika Lao","tier":"Both","designs":[{"name":"1st Place lululemon","stitches":17671,"tier":"Large","charge":"+$10/pc","design_number":38847},{"name":"Cybersecurity LuLulemon","stitches":12844,"tier":"Mid","charge":"+$4/pc","design_number":38940}]}];

let scFilter = 'all', scRep = 'all', scSearch = '', scSortCol = 'company', scSortDir = 1;

function scTierBadge(tier) {
    if (tier === 'Mid')   return '<span class="sc-tier-badge sc-tier-mid">Mid +$4</span>';
    if (tier === 'Large') return '<span class="sc-tier-badge sc-tier-large">Large +$10</span>';
    return '<span class="sc-tier-badge sc-tier-both">Mid + Large</span>';
}

function scRepChip(rep) {
    if (rep === 'Nika Lao')
        return '<span class="sc-rep-chip sc-rep-nika"><span class="sc-rep-dot"></span>Nika Lao</span>';
    if (rep === 'Taneisha Clark')
        return '<span class="sc-rep-chip sc-rep-taneisha"><span class="sc-rep-dot"></span>Taneisha Clark</span>';
    return '<span class="sc-rep-chip sc-rep-house"><span class="sc-rep-dot"></span>House</span>';
}

function scRenderRow(r) {
    const name = [r.first, r.last].filter(Boolean).join(' ') || '\u2014';
    const email = r.email ? '<div class="sc-contact-email"><a href="mailto:' + escapeHtmlStr(r.email) + '">' + escapeHtmlStr(r.email) + '</a></div>' : '';
    const phone = r.phone ? '<div class="sc-contact-phone">' + escapeHtmlStr(r.phone) + '</div>' : '';
    const designs = r.designs.map(function(d) {
        const numBadge = d.design_number ? '<span class="sc-design-num">#' + d.design_number + '</span> ' : '';
        const chargeClass = d.tier === 'Mid' ? 'sc-charge-mid' : 'sc-charge-large';
        return '<div class="sc-design-item">' +
            '<div class="sc-design-name">' + numBadge + escapeHtmlStr(d.name) + '</div>' +
            '<div class="sc-design-meta">' +
                '<span class="sc-design-stitches">' + d.stitches.toLocaleString() + ' st</span>' +
                '<span class="sc-design-charge ' + chargeClass + '">' + escapeHtmlStr(d.charge) + '</span>' +
            '</div>' +
        '</div>';
    }).join('');
    return '<tr>' +
        '<td class="sc-col-id">#' + r.id + '</td>' +
        '<td class="sc-col-company">' + escapeHtmlStr(r.company) + '</td>' +
        '<td class="sc-col-contact"><div class="sc-contact-name">' + escapeHtmlStr(name) + '</div>' + email + phone + '</td>' +
        '<td>' + scRepChip(r.rep) + '</td>' +
        '<td>' + scTierBadge(r.tier) + '</td>' +
        '<td class="sc-col-designs">' + designs + '</td>' +
    '</tr>';
}

function scUpdateStats(visible) {
    var mid = 0, large = 0;
    visible.forEach(function(r) {
        if (r.tier === 'Mid') mid++;
        else if (r.tier === 'Large') large++;
        else { mid++; large++; }
    });
    document.getElementById('scStatTotal').textContent = visible.length;
    document.getElementById('scStatMid').textContent = mid;
    document.getElementById('scStatLarge').textContent = large;
    var countEl = document.getElementById('scResultsCount');
    if (countEl) countEl.textContent = visible.length + ' of ' + SURCHARGE_CUSTOMERS.length + ' accounts';
}

function scApplySort(data) {
    return data.slice().sort(function(a, b) {
        var va, vb;
        if      (scSortCol === 'id')      { va = a.id;                    vb = b.id; }
        else if (scSortCol === 'company') { va = a.company.toLowerCase(); vb = b.company.toLowerCase(); }
        else if (scSortCol === 'rep')     { va = a.rep.toLowerCase();     vb = b.rep.toLowerCase(); }
        else if (scSortCol === 'tier')    { va = a.tier;                  vb = b.tier; }
        else return 0;
        return va < vb ? -scSortDir : va > vb ? scSortDir : 0;
    });
}

function scRender() {
    var search = scSearch.toLowerCase();
    var filtered = SURCHARGE_CUSTOMERS.filter(function(r) {
        var tierOk = scFilter === 'all'
            || (scFilter === 'Both'  && r.tier === 'Both')
            || (scFilter === 'Mid'   && (r.tier === 'Mid'   || r.tier === 'Both'))
            || (scFilter === 'Large' && (r.tier === 'Large' || r.tier === 'Both'));
        var repOk = scRep === 'all'
            || (scRep === 'unassigned' && r.rep === 'House')
            || r.rep === scRep;
        var searchOk = !search
            || r.company.toLowerCase().includes(search)
            || (r.first + ' ' + r.last).toLowerCase().includes(search)
            || r.email.toLowerCase().includes(search)
            || r.rep.toLowerCase().includes(search);
        return tierOk && repOk && searchOk;
    });
    var sorted = scApplySort(filtered);
    var tbody = document.getElementById('scTbody');
    var table = document.getElementById('scTable');
    var empty = document.getElementById('scEmptyState');
    tbody.innerHTML = sorted.length ? sorted.map(scRenderRow).join('') : '';
    empty.style.display = sorted.length ? 'none' : 'block';
    table.style.display = sorted.length ? '' : 'none';
    scUpdateStats(filtered);
}

function openSurchargeModal() {
    document.getElementById('scModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    scRender();
}

function closeSurchargeModal() {
    document.getElementById('scModal').classList.remove('open');
    document.body.style.overflow = '';
}

function initSurchargeModal() {
    var openBtn = document.getElementById('openSurchargeModal');
    var closeBtn = document.getElementById('scModalClose');
    var overlay = document.getElementById('scModal');

    if (!openBtn || !overlay) return;

    openBtn.addEventListener('click', openSurchargeModal);
    closeBtn.addEventListener('click', closeSurchargeModal);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeSurchargeModal();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeSurchargeModal();
    });

    // Search
    document.getElementById('scSearch').addEventListener('input', function(e) {
        scSearch = e.target.value;
        scRender();
    });

    // Tier filters
    document.querySelectorAll('#scTierFilters .sc-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            scFilter = btn.dataset.filter;
            document.querySelectorAll('#scTierFilters .sc-filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            scRender();
        });
    });

    // Rep filters
    document.querySelectorAll('#scRepFilters .sc-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            scRep = btn.dataset.rep;
            document.querySelectorAll('#scRepFilters .sc-filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            scRender();
        });
    });

    // Column sorting
    document.querySelectorAll('.sc-sortable').forEach(function(th) {
        th.addEventListener('click', function() {
            var col = th.dataset.col;
            if (scSortCol === col) {
                scSortDir = -scSortDir;
            } else {
                scSortCol = col;
                scSortDir = 1;
            }
            document.querySelectorAll('.sc-sortable').forEach(function(h) { h.classList.remove('sorted'); });
            th.classList.add('sorted');
            scRender();
        });
    });

    // Update button text with actual count
    openBtn.innerHTML = '<i class="fas fa-list"></i> View All ' + SURCHARGE_CUSTOMERS.length + ' Surcharge Accounts';
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

