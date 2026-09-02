/**
 * Embroidery Contract Pricing - Standalone Page JavaScript
 *
 * Fetches CONTRACT_PRICING from API and populates the three pricing tables:
 * 1. Contract Garments (8K-20K stitches × 5 quantity tiers)
 * 2. Contract Caps (8K-20K stitches × 5 quantity tiers)
 * 3. Laser Patch pricing (5 quantity tiers)
 */

// CLAUDE.md rule 6: the proxy host comes from config/app.config.js (loaded by the page); the
// literal is the offline fallback only.
const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Contract garments and caps bill a minimum of 8,000 stitches (Embroidery_Costs BaseStitchCount on
// the CTR rows; the calculator clamps to it), so the printed list starts at 8K — rows below the
// minimum printed a price nobody can actually be charged. Matches the calculator's table.
const STITCH_COUNTS = [8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000];
const RATES_EFFECTIVE = 'September 2, 2026';   // date of the last card change (stitch-cost study)

// Tier order for columns
const TIER_ORDER = ['1-7', '8-23', '24-47', '48-71', '72+'];

// Pricing data
let CONTRACT_PRICING = null;
let ORDER_MINIMUM = null;   // Service_Codes CTR-MIN-ORDER ($150), null when it could not be read

/**
 * Initialize page on DOM ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadContractPricing();
        buildGarmentsTable();
        buildCapsTable();
        buildLaserPatchTable();
        buildTerms();
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
    // The $150 order minimum is one Service_Codes row (CTR-MIN-ORDER). Its failure is shown in
    // the terms line rather than swallowed — a printed price list without the minimum is wrong.
    try {
        const r = await fetch(`${API_BASE_URL}/api/service-codes?code=CTR-MIN-ORDER`);
        const j = r.ok ? await r.json() : null;
        const rows = Array.isArray(j) ? j : (j && j.data) || [];
        const v = rows.length ? Number(rows[0].SellPrice) : NaN;
        ORDER_MINIMUM = Number.isFinite(v) && v > 0 ? v : null;
    } catch (e) {
        console.error('[contract-pricing] order minimum failed to load:', e);
        ORDER_MINIMUM = null;
    }
}

/**
 * Terms strip + full-back line — every figure from the API so the printed sheet can never
 * disagree with the calculator. Fee/band per product: garments/caps share one fee and a
 * 1-23 band; full back has its own fee on its own band (DECG-FB ladder).
 */
function buildTerms() {
    const g = CONTRACT_PRICING?.garments || {};
    const fb = CONTRACT_PRICING?.fullBack || {};
    const fee = Number(g.ltmFee) || 0;
    const band = Number(g.ltmThreshold) || 23;
    const fbFee = Number(fb.ltmFee) || 0;
    const fbBand = Number(fb.ltmThreshold) || 0;
    const minText = ORDER_MINIMUM ? formatPrice(ORDER_MINIMUM) : 'not loaded — confirm before quoting';

    const terms = document.getElementById('termsNote');
    if (terms) {
        terms.innerHTML =
            `<strong>Every contract order has a ${ORDER_MINIMUM ? formatPrice(ORDER_MINIMUM) : '(minimum not loaded)'} minimum.</strong> ` +
            `<strong>* Columns 1-7 and 8-23:</strong> a ${formatPrice(fee)} small-order fee applies once per order under ${band + 1} pieces ` +
            `and is rolled into the per-piece price. Garments and caps bill a minimum of ${(STITCH_COUNTS[0] / 1000)}K stitches. ` +
            `Rates and fees effective ${RATES_EFFECTIVE}.`;
    }
    const fbEl = document.getElementById('fullBackTerms');
    if (fbEl) {
        const rates = fb.perThousandRates || {};
        const ladder = TIER_ORDER.map(t => `${t}: ${formatPrice(Number(rates[t]) || 0)}`).join(' · ');
        fbEl.innerHTML =
            `<strong>Full back (DECG-FB)</strong> — per 1,000 stitches: ${ladder}. ` +
            `Minimum ${((Number(fb.minStitches) || 25000) / 1000)}K stitches` +
            (fbFee > 0 && fbBand > 0 ? `; ${formatPrice(fbFee)} small-order fee on orders of 1-${fbBand} pieces` : '') +
            `; ${minText === 'not loaded — confirm before quoting' ? 'order minimum ' + minText : formatPrice(ORDER_MINIMUM) + ' order minimum'}.`;
    }
    const laserFee = document.getElementById('laserLtmText');
    if (laserFee) laserFee.textContent = `Orders of 1-${band} pieces include the ${formatPrice(fee)} small-order fee · ${ORDER_MINIMUM ? formatPrice(ORDER_MINIMUM) : '(not loaded)'} order minimum on every contract order`;
    const eff = document.getElementById('effectiveDate');
    if (eff) eff.textContent = `Rates effective ${RATES_EFFECTIVE}`;
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
