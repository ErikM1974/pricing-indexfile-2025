/**
 * Customer Supplied Embroidery Calculator
 * Simplified pricing matrix display with quick calculator
 *
 * DECG Pricing (2026):
 * - Garments: Base $28-$20 (1-7 to 72+) + $1.25/1K above 8K
 * - Caps: Base $22.50-$16 (1-7 to 72+) + $1.00/1K above 8K
 * - Full Back: $1.40-$1.20/1K (8-23 to 72+, MIN 8 PIECES, min 25K stitches)
 * - LTM Fee: $50 for 1-7 pieces (garments/caps only, not full back)
 * - Heavyweight: +$10/piece (Carhartt jackets, bags, canvas, leather)
 */

// Pricing data loaded from API (no hardcoded fallbacks!)
let pricingData = null;

// Tier order for display
const TIER_ORDER = ['1-7', '8-23', '24-47', '48-71', '72+'];
const TIER_ORDER_FULLBACK = ['8-23', '24-47', '48-71', '72+'];

// Stitch counts to show in matrices
const STITCH_COUNTS_STANDARD = [8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000];
const STITCH_COUNTS_FULLBACK = [25000, 30000, 35000, 40000, 45000, 50000];


/**
 * Initialize the calculator
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Try to load pricing from API
    await loadPricingData();

    // Build all pricing matrices
    buildGarmentsMatrix();
    buildCapsMatrix();
    buildFullBackMatrix();

    // Setup quick calculator
    setupQuickCalculator();
});

/**
 * Load pricing data from API (required - no fallback!)
 */
async function loadPricingData() {
    try {
        const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/decg-pricing');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API returned ${response.status}`);
        }
        pricingData = await response.json();
        if (pricingData.error) {
            throw new Error(pricingData.message || pricingData.error);
        }
    } catch (error) {
        console.error('Failed to load DECG pricing:', error);
        showPricingError('Unable to load pricing data. Please refresh the page or contact support.');
        throw error;  // Stop execution
    }
}

/**
 * Show pricing error banner
 */
function showPricingError(message) {
    const container = document.querySelector('.main-container');
    if (!container) return;

    const errorBanner = document.createElement('div');
    errorBanner.className = 'api-error-banner';
    errorBanner.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <strong>Error:</strong> ${message}
    `;

    // Insert after header
    const header = container.querySelector('h1');
    if (header && header.nextSibling) {
        container.insertBefore(errorBanner, header.nextSibling);
    } else {
        container.insertBefore(errorBanner, container.firstChild);
    }
}

/**
 * Format price for display
 */
function formatPrice(price) {
    return '$' + price.toFixed(2);
}

/**
 * Build the garments pricing matrix
 */
function buildGarmentsMatrix() {
    const tbody = document.querySelector('#garmentsMatrix tbody');
    if (!tbody) return;

    const { basePrices, perThousandUpcharge } = pricingData.garments;

    let html = '';
    STITCH_COUNTS_STANDARD.forEach(stitches => {
        const extraK = Math.max(0, (stitches - 8000) / 1000);
        html += '<tr>';
        html += `<td class="stitch-col">${(stitches / 1000).toFixed(0)}K</td>`;

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

/**
 * Build the caps pricing matrix
 */
function buildCapsMatrix() {
    const tbody = document.querySelector('#capsMatrix tbody');
    if (!tbody) return;

    const { basePrices, perThousandUpcharge } = pricingData.caps;

    let html = '';
    STITCH_COUNTS_STANDARD.forEach(stitches => {
        const extraK = Math.max(0, (stitches - 8000) / 1000);
        html += '<tr>';
        html += `<td class="stitch-col">${(stitches / 1000).toFixed(0)}K</td>`;

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

/**
 * Build the full back pricing matrix (no 1-7 tier - min 8 pieces)
 */
function buildFullBackMatrix() {
    const tbody = document.querySelector('#fullBackMatrix tbody');
    if (!tbody) return;

    const { ratesPerThousand } = pricingData.fullBack;

    let html = '';
    STITCH_COUNTS_FULLBACK.forEach(stitches => {
        const stitchesK = stitches / 1000;
        html += '<tr>';
        html += `<td class="stitch-col">${stitchesK.toFixed(0)}K</td>`;

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

/**
 * Get tier from quantity
 */
function getTierFromQuantity(qty) {
    if (qty <= 7) return '1-7';
    if (qty <= 23) return '8-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
}

/**
 * Get tier from quantity for full back (min 8 pieces)
 */
function getTierFromQuantityFullBack(qty) {
    if (qty <= 23) return '8-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
}

/**
 * Calculate price for given parameters
 * Returns breakdown details for display
 */
function calculatePrice(itemType, quantity, stitches, isHeavyweight) {
    if (!quantity || quantity < 1) {
        return { unitPrice: 0, ltmFee: 0, total: 0, breakdown: null };
    }

    let unitPrice = 0;
    let ltmFee = 0;
    let breakdown = null;

    if (itemType === 'garment') {
        const tier = getTierFromQuantity(quantity);
        const { basePrices, perThousandUpcharge, ltmThreshold } = pricingData.garments;
        const basePrice = basePrices[tier] || 0;
        const extraK = Math.max(0, (stitches - 8000) / 1000);
        const extraStitchCharge = extraK * perThousandUpcharge;
        unitPrice = basePrice + extraStitchCharge;

        breakdown = {
            basePrice,
            baseLabel: 'Base (8K)',
            extraK,
            extraStitchCharge,
            perThousandRate: perThousandUpcharge
        };

        if (quantity <= ltmThreshold) {
            ltmFee = pricingData.garments.ltmFee;
        }
    } else if (itemType === 'cap') {
        const tier = getTierFromQuantity(quantity);
        const { basePrices, perThousandUpcharge, ltmThreshold } = pricingData.caps;
        const basePrice = basePrices[tier] || 0;
        const extraK = Math.max(0, (stitches - 8000) / 1000);
        const extraStitchCharge = extraK * perThousandUpcharge;
        unitPrice = basePrice + extraStitchCharge;

        breakdown = {
            basePrice,
            baseLabel: 'Base (8K)',
            extraK,
            extraStitchCharge,
            perThousandRate: perThousandUpcharge
        };

        if (quantity <= ltmThreshold) {
            ltmFee = pricingData.caps.ltmFee;
        }
    } else if (itemType === 'fullback') {
        const { ratesPerThousand, minStitches, minQuantity } = pricingData.fullBack;

        // Enforce minimum 8 pieces for full back
        if (quantity < minQuantity) {
            return {
                unitPrice: 0,
                ltmFee: 0,
                total: 0,
                error: `Full back requires minimum ${minQuantity} pieces`,
                breakdown: null
            };
        }

        const tier = getTierFromQuantityFullBack(quantity);
        const actualStitches = Math.max(stitches, minStitches);
        const stitchesK = actualStitches / 1000;
        const rate = ratesPerThousand[tier] || ratesPerThousand['8-23'];
        unitPrice = stitchesK * rate;

        breakdown = {
            basePrice: unitPrice,
            baseLabel: `${stitchesK.toFixed(0)}K × $${rate.toFixed(2)}`,
            extraK: 0,
            extraStitchCharge: 0,
            isFullBack: true
        };

        // No LTM fee for full back
        ltmFee = 0;
    }

    // Add heavyweight surcharge
    if (isHeavyweight) {
        unitPrice += pricingData.heavyweightSurcharge;
    }

    const total = (unitPrice * quantity) + ltmFee;

    return { unitPrice, ltmFee, total, breakdown, heavyweight: isHeavyweight ? pricingData.heavyweightSurcharge : 0 };
}

/**
 * Setup the quick calculator
 */
function setupQuickCalculator() {
    const itemTypeSelect = document.getElementById('itemType');
    const quantityInput = document.getElementById('quantity');
    const stitchesInput = document.getElementById('stitches');
    const heavyweightCheckbox = document.getElementById('heavyweight');

    const unitPriceEl = document.getElementById('unitPrice');
    const ltmFeeEl = document.getElementById('ltmFee');
    const ltmRow = document.getElementById('ltmRow');
    const totalPriceEl = document.getElementById('totalPrice');
    const baseRow = document.getElementById('baseRow');
    const baseLabel = document.getElementById('baseLabel');
    const basePrice = document.getElementById('basePrice');
    const extraStitchRow = document.getElementById('extraStitchRow');
    const extraStitchLabel = document.getElementById('extraStitchLabel');
    const extraStitchPrice = document.getElementById('extraStitchPrice');
    const heavyweightRow = document.getElementById('heavyweightRow');
    const errorRow = document.getElementById('errorRow');
    const errorMessage = document.getElementById('errorMessage');

    function updateCalculation() {
        const itemType = itemTypeSelect.value;
        const quantity = parseInt(quantityInput.value) || 0;
        const stitches = parseInt(stitchesInput.value) || 8000;
        const isHeavyweight = heavyweightCheckbox.checked;

        // Update stitch input minimum for full back
        if (itemType === 'fullback') {
            stitchesInput.min = 25000;
            if (stitches < 25000) {
                stitchesInput.value = 25000;
            }
        } else {
            stitchesInput.min = 1000;
        }

        const result = calculatePrice(itemType, quantity, parseInt(stitchesInput.value) || 8000, isHeavyweight);

        // Handle error state (e.g., full back < 8 pieces)
        if (result.error) {
            errorRow.style.display = 'flex';
            errorMessage.textContent = result.error;
            baseRow.style.display = 'none';
            extraStitchRow.style.display = 'none';
            heavyweightRow.style.display = 'none';
            ltmRow.style.display = 'none';
            unitPriceEl.textContent = '$0.00';
            totalPriceEl.textContent = '$0.00';
            return;
        }

        errorRow.style.display = 'none';

        // Show breakdown if we have valid input
        if (result.breakdown && quantity > 0) {
            baseRow.style.display = 'flex';
            baseLabel.textContent = result.breakdown.baseLabel + ':';
            basePrice.textContent = formatPrice(result.breakdown.basePrice);

            // Show extra stitch row for garments/caps (not full back)
            if (!result.breakdown.isFullBack && result.breakdown.extraK > 0) {
                extraStitchRow.style.display = 'flex';
                extraStitchLabel.textContent = `+${result.breakdown.extraK.toFixed(0)}K × $${result.breakdown.perThousandRate.toFixed(2)}:`;
                extraStitchPrice.textContent = '+' + formatPrice(result.breakdown.extraStitchCharge);
            } else {
                extraStitchRow.style.display = 'none';
            }

            // Show heavyweight row if checked
            if (isHeavyweight) {
                heavyweightRow.style.display = 'flex';
            } else {
                heavyweightRow.style.display = 'none';
            }
        } else {
            baseRow.style.display = 'none';
            extraStitchRow.style.display = 'none';
            heavyweightRow.style.display = 'none';
        }

        unitPriceEl.textContent = formatPrice(result.unitPrice);

        if (result.ltmFee > 0) {
            ltmRow.style.display = 'flex';
            ltmFeeEl.textContent = '+' + formatPrice(result.ltmFee);
        } else {
            ltmRow.style.display = 'none';
        }

        totalPriceEl.textContent = formatPrice(result.total);
    }

    // Bind events
    itemTypeSelect.addEventListener('change', updateCalculation);
    quantityInput.addEventListener('input', updateCalculation);
    stitchesInput.addEventListener('input', updateCalculation);
    heavyweightCheckbox.addEventListener('change', updateCalculation);

    // Initial calculation
    updateCalculation();
}
