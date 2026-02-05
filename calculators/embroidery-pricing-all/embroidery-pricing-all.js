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

        // Build all matrices
        buildContractGarmentsMatrix();
        buildContractCapsMatrix();
        buildContractFullBackMatrix();
        buildAlRetailGarmentsMatrix();
        buildAlRetailCapsMatrix();
        buildDecgRetailGarmentsMatrix();
        buildDecgRetailCapsMatrix();

        // Setup calculators
        setupContractCalculator();
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
    const stitchesEl = document.getElementById('contractStitches');
    let stitches = parseInt(stitchesEl.value) || 8000;

    // Update min stitches for full back
    const minStitches = CONTRACT_PRICING.fullBack?.minStitches || 25000;
    if (itemType === 'fullback') {
        stitchesEl.min = minStitches;
        if (stitches < minStitches) {
            stitches = minStitches;
            stitchesEl.value = minStitches;
        }
    } else {
        stitchesEl.min = 1000;
    }

    // Elements
    const baseRow = document.getElementById('contractBaseRow');
    const baseLabel = document.getElementById('contractBaseLabel');
    const basePriceEl = document.getElementById('contractBasePrice');
    const unitPriceEl = document.getElementById('contractUnitPrice');
    const ltmRow = document.getElementById('contractLtmRow');
    const ltmFeeEl = document.getElementById('contractLtmFee');
    const totalPriceEl = document.getElementById('contractTotalPrice');
    const hourlyRow = document.getElementById('contractHourlyRow');
    const hourlyRevenueEl = document.getElementById('contractHourlyRevenue');

    let unitPrice = 0;
    let ltmFee = 0;
    let hourlyRevenue = 0;
    const tier = getTierFromQuantity(quantity);
    const ltmThreshold = CONTRACT_PRICING.ltmThreshold || 23;
    const ltmFeeAmount = CONTRACT_PRICING.ltmFee || 50;

    if (itemType === 'garment') {
        // Linear per-thousand pricing model
        const rate = CONTRACT_PRICING.garments.perThousandRates[tier];
        const stitchesK = stitches / 1000;
        unitPrice = stitchesK * rate;

        baseLabel.textContent = `${stitchesK}K x ${formatPrice(rate)}/1K @ ${tier}:`;
        basePriceEl.textContent = formatPrice(unitPrice);

        if (quantity > 0 && quantity <= ltmThreshold) {
            ltmFee = ltmFeeAmount;
        }

        // Calculate hourly revenue using static production rates (use closest available)
        const closestStitches = getClosestStitchCount(stitches, 'garment');
        const prodRate = PRODUCTION_RATES.garments[closestStitches] || 16;
        hourlyRevenue = unitPrice * prodRate;

    } else if (itemType === 'cap') {
        // Linear per-thousand pricing model
        const rate = CONTRACT_PRICING.caps.perThousandRates[tier];
        const stitchesK = stitches / 1000;
        unitPrice = stitchesK * rate;

        baseLabel.textContent = `${stitchesK}K x ${formatPrice(rate)}/1K @ ${tier}:`;
        basePriceEl.textContent = formatPrice(unitPrice);

        if (quantity > 0 && quantity <= ltmThreshold) {
            ltmFee = ltmFeeAmount;
        }

        // Calculate hourly revenue using static production rates (use closest available)
        const closestStitches = getClosestStitchCount(stitches, 'cap');
        const prodRate = PRODUCTION_RATES.caps[closestStitches] || 22;
        hourlyRevenue = unitPrice * prodRate;

    } else if (itemType === 'fullback') {
        const rate = CONTRACT_PRICING.fullBack.perThousandRates[tier];
        const stitchesK = stitches / 1000;
        const minPrice = CONTRACT_PRICING.fullBack.minPrice || 20.00;
        unitPrice = Math.max(stitchesK * rate, minPrice);

        baseLabel.textContent = `${stitchesK}K x ${formatPrice(rate)}/1K:`;
        basePriceEl.textContent = formatPrice(unitPrice);

        if (quantity > 0 && quantity <= ltmThreshold) {
            ltmFee = ltmFeeAmount;
        }

        // Full back hourly is harder to estimate
        hourlyRevenue = 0;
    }

    // Update UI
    if (quantity > 0) {
        baseRow.classList.remove('hidden');
    } else {
        baseRow.classList.add('hidden');
    }

    unitPriceEl.textContent = formatPrice(unitPrice);

    if (ltmFee > 0) {
        ltmRow.classList.remove('hidden');
        ltmFeeEl.textContent = '+' + formatPrice(ltmFee);
    } else {
        ltmRow.classList.add('hidden');
    }

    const total = (unitPrice * quantity) + ltmFee;
    totalPriceEl.textContent = formatPrice(total);

    // Hourly revenue check
    if (hourlyRevenue > 0 && itemType !== 'fullback') {
        hourlyRow.classList.remove('hidden');
        hourlyRevenueEl.textContent = formatPrice(hourlyRevenue) + '/hr';
        // Color code: green if >= $100, yellow if $90-100, red if < $90
        if (hourlyRevenue >= 100) {
            hourlyRevenueEl.className = 'hourly-check good';
        } else if (hourlyRevenue >= 90) {
            hourlyRevenueEl.className = 'hourly-check warn';
        } else {
            hourlyRevenueEl.className = 'hourly-check bad';
        }
    } else {
        hourlyRow.classList.add('hidden');
    }
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

    // Elements
    const baseRow = document.getElementById('decgRetailBaseRow');
    const baseLabel = document.getElementById('decgRetailBaseLabel');
    const basePriceEl = document.getElementById('decgRetailBasePrice');
    const extraStitchRow = document.getElementById('decgRetailExtraStitchRow');
    const extraStitchLabel = document.getElementById('decgRetailExtraStitchLabel');
    const extraStitchPrice = document.getElementById('decgRetailExtraStitchPrice');
    const heavyweightRow = document.getElementById('decgRetailHeavyweightRow');
    const unitPriceEl = document.getElementById('decgRetailUnitPrice');
    const ltmRow = document.getElementById('decgRetailLtmRow');
    const ltmFeeEl = document.getElementById('decgRetailLtmFee');
    const totalPriceEl = document.getElementById('decgRetailTotalPrice');

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

    const extraK = Math.max(0, (stitches - baseStitches) / 1000);
    const extraCharge = extraK * perThousandUpcharge;
    let unitPrice = basePrice + extraCharge;

    // Update UI
    if (quantity > 0) {
        baseRow.classList.remove('hidden');
        baseLabel.textContent = `Base (${baseStitches / 1000}K):`;
        basePriceEl.textContent = formatPrice(basePrice);

        if (extraK > 0) {
            extraStitchRow.classList.remove('hidden');
            extraStitchLabel.textContent = `+${extraK.toFixed(0)}K extra:`;
            extraStitchPrice.textContent = '+' + formatPrice(extraCharge);
        } else {
            extraStitchRow.classList.add('hidden');
        }
    } else {
        baseRow.classList.add('hidden');
        extraStitchRow.classList.add('hidden');
    }

    // Heavyweight surcharge
    const heavyweightSurcharge = DECG_RETAIL_PRICING.heavyweightSurcharge || 10.00;
    if (isHeavyweight) {
        heavyweightRow.classList.remove('hidden');
        unitPrice += heavyweightSurcharge;
    } else {
        heavyweightRow.classList.add('hidden');
    }

    unitPriceEl.textContent = formatPrice(unitPrice);

    // LTM fee
    const ltmThreshold = pricing.ltmThreshold || 7;
    const ltmFeeAmount = pricing.ltmFee || 50;
    let ltmFee = 0;
    if (quantity > 0 && quantity <= ltmThreshold) {
        ltmFee = ltmFeeAmount;
        ltmRow.classList.remove('hidden');
        ltmFeeEl.textContent = '+' + formatPrice(ltmFee);
    } else {
        ltmRow.classList.add('hidden');
    }

    const total = (unitPrice * quantity) + ltmFee;
    totalPriceEl.textContent = formatPrice(total);
}
