/**
 * Embroidery Contract Pricing - Standalone Page JavaScript
 *
 * Fetches CONTRACT_PRICING from API and populates the three pricing tables:
 * 1. Contract Garments (5K-15K stitches × 5 quantity tiers)
 * 2. Contract Caps (5K-15K stitches × 5 quantity tiers)
 * 3. Laser Patch pricing (5 quantity tiers)
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Stitch counts for display (5K-15K only)
const STITCH_COUNTS = [5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000];

// Tier order for columns
const TIER_ORDER = ['1-7', '8-23', '24-47', '48-71', '72+'];

// Pricing data
let CONTRACT_PRICING = null;

/**
 * Initialize page on DOM ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadContractPricing();
        buildGarmentsTable();
        buildCapsTable();
        buildLaserPatchTable();
        hideLoadingState();
    } catch (error) {
        showError('Unable to load pricing data. Please refresh the page or try again later.');
    }
});

/**
 * Fetch contract pricing from API
 */
async function loadContractPricing() {
    const response = await fetch(`${API_BASE_URL}/api/contract-pricing`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    CONTRACT_PRICING = data;
}

/**
 * Build the garments pricing table
 */
function buildGarmentsTable() {
    const tbody = document.getElementById('garmentsTableBody');
    if (!tbody || !CONTRACT_PRICING?.garments) return;

    const rates = CONTRACT_PRICING.garments.perThousandRates;
    let html = '';

    STITCH_COUNTS.forEach(stitches => {
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
 * Build the caps pricing table
 */
function buildCapsTable() {
    const tbody = document.getElementById('capsTableBody');
    if (!tbody || !CONTRACT_PRICING?.caps) return;

    const rates = CONTRACT_PRICING.caps.perThousandRates;
    let html = '';

    STITCH_COUNTS.forEach(stitches => {
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
 * Build laser patch pricing table
 * Formula: (Contract Cap 8K rate × 8) + $5, rounded up to $0.50
 */
function buildLaserPatchTable() {
    const tbody = document.getElementById('laserPatchTableBody');
    if (!tbody || !CONTRACT_PRICING?.caps) return;

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

/**
 * Format price as currency
 */
function formatPrice(value) {
    return '$' + value.toFixed(2);
}

/**
 * Hide loading state and show content
 */
function hideLoadingState() {
    const loading = document.getElementById('loadingState');
    const content = document.getElementById('pricingContent');
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
}

/**
 * Show error banner
 */
function showError(message) {
    const loading = document.getElementById('loadingState');
    const errorBanner = document.getElementById('errorBanner');
    if (loading) loading.style.display = 'none';
    if (errorBanner) {
        errorBanner.textContent = message;
        errorBanner.classList.add('show');
    }
}

/**
 * Print the contract pricing page as PDF
 */
function printContractPricing() {
    window.print();
}
