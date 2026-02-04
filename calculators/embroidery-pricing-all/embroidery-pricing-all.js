/**
 * Embroidery Pricing All - Unified Embroidery Pricing Page
 *
 * Combines AL/CEMB (Additional Logo / Contract) and DECG (Customer-Supplied) pricing
 * in a single tabbed interface with pricing matrices and calculators.
 *
 * AL/CEMB Pricing (Feb 2026):
 * - Garments: 5K base, $13→$5, +$1.00/1K
 * - Caps: 5K base, $6.50→$4, +$1.00/1K
 * - Full Back: $1.25/1K flat, 25K minimum
 * - LTM: $50 for qty 1-7
 *
 * DECG Pricing (Feb 2026):
 * - Garments: 8K base, $28→$20, +$1.25/1K
 * - Caps: 8K base, $22.50→$16, +$1.00/1K
 * - Full Back: $1.40-$1.20/1K by tier, 25K min, min 8 pieces
 * - LTM: $50 for qty 1-7 (garments/caps only)
 * - Heavyweight: +$10/piece
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Pricing data from APIs
let alPricingData = null;
let decgPricingData = null;

// Tier orders
const TIER_ORDER = ['1-7', '8-23', '24-47', '48-71', '72+'];
const TIER_ORDER_FULLBACK = ['8-23', '24-47', '48-71', '72+'];

// Stitch counts for matrices
const AL_STITCH_COUNTS = [5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000];
const DECG_STITCH_COUNTS = [8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000];
const FB_STITCH_COUNTS = [25000, 30000, 35000, 40000, 45000, 50000];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load both pricing datasets in parallel
        await Promise.all([
            loadAlPricing(),
            loadDecgPricing()
        ]);

        // Build all matrices
        buildAlGarmentsMatrix();
        buildAlCapsMatrix();
        buildAlFullBackMatrix();
        buildDecgGarmentsMatrix();
        buildDecgCapsMatrix();
        buildDecgFullBackMatrix();

        // Setup calculators
        setupAlCalculator();
        setupDecgCalculator();

    } catch (error) {
        console.error('Failed to initialize pricing page:', error);
        showError('Unable to load pricing data. Please refresh the page.');
    }
});

// ============================================
// API LOADING
// ============================================

async function loadAlPricing() {
    const response = await fetch(`${API_BASE_URL}/api/al-pricing`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `AL API returned ${response.status}`);
    }
    alPricingData = await response.json();
    if (alPricingData.error) {
        throw new Error(alPricingData.message || alPricingData.error);
    }
    console.log('AL pricing loaded:', alPricingData);
}

async function loadDecgPricing() {
    const response = await fetch(`${API_BASE_URL}/api/decg-pricing`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `DECG API returned ${response.status}`);
    }
    decgPricingData = await response.json();
    if (decgPricingData.error) {
        throw new Error(decgPricingData.message || decgPricingData.error);
    }
    console.log('DECG pricing loaded:', decgPricingData);
}

function showError(message) {
    const banner = document.getElementById('apiErrorBanner');
    const messageEl = document.getElementById('apiErrorMessage');
    if (banner && messageEl) {
        messageEl.textContent = message;
        banner.classList.remove('hidden');
    }
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

function getTierFromQuantityFullBack(qty) {
    if (qty <= 23) return '8-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
}

// ============================================
// AL/CEMB MATRICES
// ============================================

function buildAlGarmentsMatrix() {
    const tbody = document.querySelector('#alGarmentsMatrix tbody');
    if (!tbody || !alPricingData) return;

    const { basePrices, perThousandUpcharge, baseStitches } = alPricingData.garments;

    let html = '';
    AL_STITCH_COUNTS.forEach(stitches => {
        const extraK = Math.max(0, (stitches - baseStitches) / 1000);
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const basePrice = basePrices[tier] || 0;
            const price = basePrice + (extraK * perThousandUpcharge);
            const cellClass = idx === 0 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildAlCapsMatrix() {
    const tbody = document.querySelector('#alCapsMatrix tbody');
    if (!tbody || !alPricingData) return;

    const { basePrices, perThousandUpcharge, baseStitches } = alPricingData.caps;

    let html = '';
    AL_STITCH_COUNTS.forEach(stitches => {
        const extraK = Math.max(0, (stitches - baseStitches) / 1000);
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const basePrice = basePrices[tier] || 0;
            const price = basePrice + (extraK * perThousandUpcharge);
            const cellClass = idx === 0 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildAlFullBackMatrix() {
    const tbody = document.querySelector('#alFullBackMatrix tbody');
    if (!tbody || !alPricingData) return;

    const { ratePerThousand, minStitches } = alPricingData.fullBack;

    let html = '';
    FB_STITCH_COUNTS.forEach(stitches => {
        const stitchesK = stitches / 1000;
        const price = stitchesK * ratePerThousand;
        html += '<tr>';
        html += `<td>${stitchesK.toFixed(0)}K</td>`;
        html += `<td>${formatPrice(price)}</td>`;
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

// ============================================
// DECG MATRICES
// ============================================

function buildDecgGarmentsMatrix() {
    const tbody = document.querySelector('#decgGarmentsMatrix tbody');
    if (!tbody || !decgPricingData) return;

    const { basePrices, perThousandUpcharge } = decgPricingData.garments;
    const baseStitches = 8000; // DECG uses 8K base

    let html = '';
    DECG_STITCH_COUNTS.forEach(stitches => {
        const extraK = Math.max(0, (stitches - baseStitches) / 1000);
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const basePrice = basePrices[tier] || 0;
            const price = basePrice + (extraK * perThousandUpcharge);
            const cellClass = idx === 0 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildDecgCapsMatrix() {
    const tbody = document.querySelector('#decgCapsMatrix tbody');
    if (!tbody || !decgPricingData) return;

    const { basePrices, perThousandUpcharge } = decgPricingData.caps;
    const baseStitches = 8000;

    let html = '';
    DECG_STITCH_COUNTS.forEach(stitches => {
        const extraK = Math.max(0, (stitches - baseStitches) / 1000);
        html += '<tr>';
        html += `<td>${(stitches / 1000).toFixed(0)}K</td>`;

        TIER_ORDER.forEach((tier, idx) => {
            const basePrice = basePrices[tier] || 0;
            const price = basePrice + (extraK * perThousandUpcharge);
            const cellClass = idx === 0 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function buildDecgFullBackMatrix() {
    const tbody = document.querySelector('#decgFullBackMatrix tbody');
    if (!tbody || !decgPricingData) return;

    const { ratesPerThousand } = decgPricingData.fullBack;

    let html = '';
    FB_STITCH_COUNTS.forEach(stitches => {
        const stitchesK = stitches / 1000;
        html += '<tr>';
        html += `<td>${stitchesK.toFixed(0)}K</td>`;

        TIER_ORDER_FULLBACK.forEach((tier, idx) => {
            const rate = ratesPerThousand[tier] || 0;
            const price = stitchesK * rate;
            const cellClass = idx === TIER_ORDER_FULLBACK.length - 1 ? 'best-col' : '';
            html += `<td class="${cellClass}">${formatPrice(price)}</td>`;
        });

        html += '</tr>';
    });

    tbody.innerHTML = html;
}

// ============================================
// AL/CEMB CALCULATOR
// ============================================

function setupAlCalculator() {
    const itemTypeEl = document.getElementById('alItemType');
    const quantityEl = document.getElementById('alQuantity');
    const stitchesEl = document.getElementById('alStitches');

    if (!itemTypeEl || !quantityEl || !stitchesEl) return;

    const updateCalc = () => calculateAlPrice();

    itemTypeEl.addEventListener('change', updateCalc);
    quantityEl.addEventListener('input', updateCalc);
    stitchesEl.addEventListener('input', updateCalc);

    // Initial calculation
    updateCalc();
}

function calculateAlPrice() {
    if (!alPricingData) return;

    const itemType = document.getElementById('alItemType').value;
    const quantity = parseInt(document.getElementById('alQuantity').value) || 0;
    const stitches = parseInt(document.getElementById('alStitches').value) || 5000;

    // Update min stitches for full back
    const stitchesEl = document.getElementById('alStitches');
    if (itemType === 'fullback') {
        stitchesEl.min = 25000;
        if (stitches < 25000) stitchesEl.value = 25000;
    } else {
        stitchesEl.min = 1000;
    }

    // Elements
    const baseRow = document.getElementById('alBaseRow');
    const baseLabel = document.getElementById('alBaseLabel');
    const basePrice = document.getElementById('alBasePrice');
    const extraStitchRow = document.getElementById('alExtraStitchRow');
    const extraStitchLabel = document.getElementById('alExtraStitchLabel');
    const extraStitchPrice = document.getElementById('alExtraStitchPrice');
    const unitPriceEl = document.getElementById('alUnitPrice');
    const ltmRow = document.getElementById('alLtmRow');
    const ltmFeeEl = document.getElementById('alLtmFee');
    const totalPriceEl = document.getElementById('alTotalPrice');

    let unitPrice = 0;
    let ltmFee = 0;
    let breakdown = null;

    if (itemType === 'garment') {
        const tier = getTierFromQuantity(quantity);
        const { basePrices, perThousandUpcharge, baseStitches, ltmThreshold } = alPricingData.garments;
        const base = basePrices[tier] || 0;
        const extraK = Math.max(0, (parseInt(stitchesEl.value) - baseStitches) / 1000);
        const extraCharge = extraK * perThousandUpcharge;
        unitPrice = base + extraCharge;

        breakdown = { base, extraK, extraCharge, baseLabel: `Base (${baseStitches / 1000}K)` };

        if (quantity > 0 && quantity <= ltmThreshold) {
            ltmFee = alPricingData.garments.ltmFee || 50;
        }
    } else if (itemType === 'cap') {
        const tier = getTierFromQuantity(quantity);
        const { basePrices, perThousandUpcharge, baseStitches, ltmThreshold } = alPricingData.caps;
        const base = basePrices[tier] || 0;
        const extraK = Math.max(0, (parseInt(stitchesEl.value) - baseStitches) / 1000);
        const extraCharge = extraK * perThousandUpcharge;
        unitPrice = base + extraCharge;

        breakdown = { base, extraK, extraCharge, baseLabel: `Base (${baseStitches / 1000}K)` };

        if (quantity > 0 && quantity <= ltmThreshold) {
            ltmFee = alPricingData.caps.ltmFee || 50;
        }
    } else if (itemType === 'fullback') {
        const { ratePerThousand, minStitches } = alPricingData.fullBack;
        const actualStitches = Math.max(parseInt(stitchesEl.value), minStitches);
        const stitchesK = actualStitches / 1000;
        unitPrice = stitchesK * ratePerThousand;

        breakdown = { base: unitPrice, extraK: 0, extraCharge: 0, baseLabel: `${stitchesK}K x $${ratePerThousand.toFixed(2)}`, isFlat: true };
        // No LTM for full back
    }

    // Update UI
    if (breakdown && quantity > 0) {
        baseRow.classList.remove('hidden');
        baseLabel.textContent = breakdown.baseLabel + ':';
        basePrice.textContent = formatPrice(breakdown.base);

        if (!breakdown.isFlat && breakdown.extraK > 0) {
            extraStitchRow.classList.remove('hidden');
            extraStitchLabel.textContent = `+${breakdown.extraK.toFixed(0)}K extra:`;
            extraStitchPrice.textContent = '+' + formatPrice(breakdown.extraCharge);
        } else {
            extraStitchRow.classList.add('hidden');
        }
    } else {
        baseRow.classList.add('hidden');
        extraStitchRow.classList.add('hidden');
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
}

// ============================================
// DECG CALCULATOR
// ============================================

function setupDecgCalculator() {
    const itemTypeEl = document.getElementById('decgItemType');
    const quantityEl = document.getElementById('decgQuantity');
    const stitchesEl = document.getElementById('decgStitches');
    const heavyweightEl = document.getElementById('decgHeavyweight');

    if (!itemTypeEl || !quantityEl || !stitchesEl || !heavyweightEl) return;

    const updateCalc = () => calculateDecgPrice();

    itemTypeEl.addEventListener('change', updateCalc);
    quantityEl.addEventListener('input', updateCalc);
    stitchesEl.addEventListener('input', updateCalc);
    heavyweightEl.addEventListener('change', updateCalc);

    // Initial calculation
    updateCalc();
}

function calculateDecgPrice() {
    if (!decgPricingData) return;

    const itemType = document.getElementById('decgItemType').value;
    const quantity = parseInt(document.getElementById('decgQuantity').value) || 0;
    const stitches = parseInt(document.getElementById('decgStitches').value) || 8000;
    const isHeavyweight = document.getElementById('decgHeavyweight').checked;

    // Update min stitches for full back
    const stitchesEl = document.getElementById('decgStitches');
    if (itemType === 'fullback') {
        stitchesEl.min = 25000;
        if (stitches < 25000) stitchesEl.value = 25000;
    } else {
        stitchesEl.min = 1000;
    }

    // Elements
    const baseRow = document.getElementById('decgBaseRow');
    const baseLabel = document.getElementById('decgBaseLabel');
    const basePriceEl = document.getElementById('decgBasePrice');
    const extraStitchRow = document.getElementById('decgExtraStitchRow');
    const extraStitchLabel = document.getElementById('decgExtraStitchLabel');
    const extraStitchPrice = document.getElementById('decgExtraStitchPrice');
    const heavyweightRow = document.getElementById('decgHeavyweightRow');
    const unitPriceEl = document.getElementById('decgUnitPrice');
    const ltmRow = document.getElementById('decgLtmRow');
    const ltmFeeEl = document.getElementById('decgLtmFee');
    const errorRow = document.getElementById('decgErrorRow');
    const errorMessage = document.getElementById('decgErrorMessage');
    const totalPriceEl = document.getElementById('decgTotalPrice');

    let unitPrice = 0;
    let ltmFee = 0;
    let breakdown = null;
    let error = null;

    if (itemType === 'garment') {
        const tier = getTierFromQuantity(quantity);
        const { basePrices, perThousandUpcharge, ltmThreshold } = decgPricingData.garments;
        const baseStitches = 8000;
        const base = basePrices[tier] || 0;
        const extraK = Math.max(0, (parseInt(stitchesEl.value) - baseStitches) / 1000);
        const extraCharge = extraK * perThousandUpcharge;
        unitPrice = base + extraCharge;

        breakdown = { base, extraK, extraCharge, baseLabel: 'Base (8K)' };

        if (quantity > 0 && quantity <= ltmThreshold) {
            ltmFee = decgPricingData.garments.ltmFee || 50;
        }
    } else if (itemType === 'cap') {
        const tier = getTierFromQuantity(quantity);
        const { basePrices, perThousandUpcharge, ltmThreshold } = decgPricingData.caps;
        const baseStitches = 8000;
        const base = basePrices[tier] || 0;
        const extraK = Math.max(0, (parseInt(stitchesEl.value) - baseStitches) / 1000);
        const extraCharge = extraK * perThousandUpcharge;
        unitPrice = base + extraCharge;

        breakdown = { base, extraK, extraCharge, baseLabel: 'Base (8K)' };

        if (quantity > 0 && quantity <= ltmThreshold) {
            ltmFee = decgPricingData.caps.ltmFee || 50;
        }
    } else if (itemType === 'fullback') {
        const { ratesPerThousand, minStitches, minQuantity } = decgPricingData.fullBack;

        if (quantity > 0 && quantity < minQuantity) {
            error = `Full back requires minimum ${minQuantity} pieces`;
        } else {
            const tier = getTierFromQuantityFullBack(quantity);
            const actualStitches = Math.max(parseInt(stitchesEl.value), minStitches);
            const stitchesK = actualStitches / 1000;
            const rate = ratesPerThousand[tier] || ratesPerThousand['8-23'];
            unitPrice = stitchesK * rate;

            breakdown = { base: unitPrice, extraK: 0, extraCharge: 0, baseLabel: `${stitchesK}K x $${rate.toFixed(2)}`, isFlat: true };
        }
        // No LTM for full back
    }

    // Add heavyweight surcharge
    if (isHeavyweight && !error) {
        unitPrice += decgPricingData.heavyweightSurcharge || 10;
    }

    // Update UI
    if (error) {
        errorRow.classList.remove('hidden');
        errorMessage.textContent = error;
        baseRow.classList.add('hidden');
        extraStitchRow.classList.add('hidden');
        heavyweightRow.classList.add('hidden');
        ltmRow.classList.add('hidden');
        unitPriceEl.textContent = '$0.00';
        totalPriceEl.textContent = '$0.00';
        return;
    }

    errorRow.classList.add('hidden');

    if (breakdown && quantity > 0) {
        baseRow.classList.remove('hidden');
        baseLabel.textContent = breakdown.baseLabel + ':';
        basePriceEl.textContent = formatPrice(breakdown.base);

        if (!breakdown.isFlat && breakdown.extraK > 0) {
            extraStitchRow.classList.remove('hidden');
            extraStitchLabel.textContent = `+${breakdown.extraK.toFixed(0)}K extra:`;
            extraStitchPrice.textContent = '+' + formatPrice(breakdown.extraCharge);
        } else {
            extraStitchRow.classList.add('hidden');
        }
    } else {
        baseRow.classList.add('hidden');
        extraStitchRow.classList.add('hidden');
    }

    if (isHeavyweight) {
        heavyweightRow.classList.remove('hidden');
    } else {
        heavyweightRow.classList.add('hidden');
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
}
