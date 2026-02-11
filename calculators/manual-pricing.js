/**
 * Manual Pricing Calculator — Unified Page
 * Orchestrates all 5 pricing services to show decorated sell prices
 * for a user-supplied blank garment/cap cost.
 *
 * Services used (no modifications needed):
 *   DTGPricingService, DTFPricingService, EmbroideryPricingService,
 *   CapEmbroideryPricingService, ScreenPrintPricingService
 */

class ManualPricingCalculator {
    constructor() {
        this.currentItemType = 'garment';
        this.currentCost = null;

        // Cached API results (re-render without re-fetching when dropdown changes)
        this.cachedData = {
            dtg: null,
            dtf: null,
            emb: null,
            capEmb: null,
            sp: null
        };

        // Service instances
        this.services = {
            dtg: new DTGPricingService(),
            dtf: new DTFPricingService(),
            emb: new EmbroideryPricingService(),
            capEmb: new CapEmbroideryPricingService(),
            sp: new ScreenPrintPricingService()
        };

        this.checkUrlParams();
        console.log('[ManualPricing] Calculator initialized');
    }

    // =========================================================
    // URL PARAMS & ITEM TYPE
    // =========================================================

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const cost = parseFloat(params.get('cost') || params.get('manualCost'));
        const type = params.get('type');

        if (type === 'cap') {
            this.setItemType('cap');
        }

        if (!isNaN(cost) && cost > 0 && cost < 1000) {
            document.getElementById('blankCost').value = cost.toFixed(2);
            // Delay to let services initialize
            setTimeout(() => this.calculate(), 100);
        }
    }

    setItemType(type) {
        this.currentItemType = type;

        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Show/hide card groups
        document.getElementById('garmentCards').style.display = type === 'garment' ? 'block' : 'none';
        document.getElementById('capCards').style.display = type === 'cap' ? 'block' : 'none';

        // Recalculate if we have a cost
        if (this.currentCost) {
            this.calculate();
        }
    }

    // =========================================================
    // MAIN CALCULATE
    // =========================================================

    async calculate() {
        const input = document.getElementById('blankCost');
        const cost = parseFloat(input.value);

        // Validate
        if (isNaN(cost) || cost <= 0) {
            this.showInputError('Please enter a valid cost greater than $0');
            return;
        }
        if (cost > 999) {
            this.showInputError('Cost seems unusually high. Please verify.');
            return;
        }

        this.hideInputError();
        this.currentCost = cost;

        // Show cards container
        document.getElementById('methodCards').style.display = 'block';

        if (this.currentItemType === 'garment') {
            this.showLoading('dtgBody');
            this.showLoading('dtfBody');
            this.showLoading('embBody');
            this.showLoading('spBody');

            // Fire all 4 garment methods in parallel
            const results = await Promise.allSettled([
                this.fetchDTG(cost),
                this.fetchDTF(cost),
                this.fetchEmbroidery(cost),
                this.fetchScreenPrint(cost)
            ]);

            this.handleResult(results[0], 'dtgBody', 'DTG');
            this.handleResult(results[1], 'dtfBody', 'DTF');
            this.handleResult(results[2], 'embBody', 'Embroidery');
            this.handleResult(results[3], 'spBody', 'Screen Print');

        } else {
            this.showLoading('capEmbBody');

            const results = await Promise.allSettled([
                this.fetchCapEmbroidery(cost)
            ]);

            this.handleResult(results[0], 'capEmbBody', 'Cap Embroidery');
        }
    }

    handleResult(result, bodyId, methodName) {
        if (result.status === 'rejected') {
            console.error(`[ManualPricing] ${methodName} failed:`, result.reason);
            this.showCardError(bodyId, `Unable to load ${methodName} pricing. Please refresh.`);
        }
        // fulfilled results are already rendered by their fetch functions
    }

    // =========================================================
    // DTG
    // =========================================================

    async fetchDTG(cost) {
        const data = await this.services.dtg.generateManualPricingData(cost);
        this.cachedData.dtg = data;

        // Populate location dropdown from data
        const select = document.getElementById('dtgLocation');
        if (select.options.length === 0) {
            const locations = data.pricing.locations || this.services.dtg.locations || [];
            locations.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc.code;
                opt.textContent = loc.name;
                select.appendChild(opt);
            });
        }

        this.renderDTG();
    }

    renderDTG() {
        const data = this.cachedData.dtg;
        if (!data) return;

        const locationCode = document.getElementById('dtgLocation').value || 'LC';
        const { tiers, costs, sizes, upcharges } = data.pricing;

        // Build table rows for each tier
        const sizeLabels = sizes.map(s => s.size);
        const baseGarmentCost = Math.min(...sizes.map(s => parseFloat(s.price)).filter(p => p > 0));

        // Build a synthetic "1-23" tier using 24-47 pricing
        const tier2447 = tiers.find(t => t.TierLabel === '24-47');
        const allTiers = [];
        if (tier2447) {
            allTiers.push({ ...tier2447, TierLabel: '1-23', displayLabel: '1-23', isLTM: true });
        }
        tiers.forEach(t => {
            allTiers.push({ ...t, displayLabel: t.TierLabel, isLTM: false });
        });

        const rows = [];
        const locationCodes = locationCode.split('_');

        allTiers.forEach(tier => {
            // Find print cost for this location and tier (use the real tier label for cost lookup)
            const lookupTier = tier.isLTM ? '24-47' : tier.TierLabel;
            let totalPrintCost = 0;
            locationCodes.forEach(code => {
                const costEntry = costs.find(c =>
                    c.PrintLocationCode === code && c.TierLabel === lookupTier
                );
                if (costEntry) {
                    totalPrintCost += parseFloat(costEntry.PrintCost);
                }
            });

            const markedUp = baseGarmentCost / tier.MarginDenominator;
            const basePrice = markedUp + totalPrintCost;
            const roundedBase = Math.ceil(basePrice * 2) / 2;

            const sizePrices = {};
            sizeLabels.forEach(size => {
                const upcharge = parseFloat(upcharges[size] || 0);
                sizePrices[size] = roundedBase + upcharge;
            });

            rows.push({
                label: tier.displayLabel,
                isLTM: tier.isLTM,
                prices: sizePrices
            });
        });

        this.renderPricingTable('dtgBody', sizeLabels, rows, { ltmNote: 'Orders under 24 pieces incur a $50 LTM fee' });
    }

    onDTGLocationChange() {
        if (this.cachedData.dtg) {
            this.renderDTG();
        }
    }

    // =========================================================
    // DTF
    // =========================================================

    async fetchDTF(cost) {
        const data = await this.services.dtf.generateManualPricingData(cost);
        // Set apiData on the service so helper methods work
        this.services.dtf.apiData = data;
        this.cachedData.dtf = data;
        this.renderDTF();
    }

    renderDTF() {
        const data = this.cachedData.dtf;
        if (!data) return;

        const sizeKey = document.getElementById('dtfTransferSize').value || 'medium';
        const transferSize = data.transferSizes[sizeKey];
        if (!transferSize || !transferSize.pricingTiers.length) {
            this.showCardError('dtfBody', 'No pricing data for this transfer size');
            return;
        }

        const rows = [];
        transferSize.pricingTiers.forEach(transferTier => {
            // Find margin tier for representative quantity
            const repQty = transferTier.minQty;
            const marginTier = data.pricingTiers.find(t =>
                repQty >= t.minQuantity && repQty <= t.maxQuantity
            );
            const marginDenom = marginTier ? marginTier.marginDenominator : 0.57;

            // Find freight for this quantity range
            const freightTier = data.freightTiers.find(t =>
                repQty >= t.minQty && repQty <= t.maxQty
            );
            const freight = freightTier ? freightTier.costPerTransfer : 0;

            const garmentSell = this.currentCost / marginDenom;
            const rawTotal = garmentSell + transferTier.unitPrice + data.laborCostPerLocation + freight;
            const finalPrice = Math.ceil(rawTotal * 2) / 2;

            const isLTM = marginTier && marginTier.ltmFee > 0;

            rows.push({
                label: transferTier.range || `${transferTier.minQty}-${transferTier.maxQty}`,
                isLTM: isLTM,
                prices: { 'Price': finalPrice }
            });
        });

        this.renderPricingTable('dtfBody', ['Price'], rows, {
            ltmNote: 'Small orders may incur an LTM fee',
            singleColumn: true
        });
    }

    onDTFSizeChange() {
        if (this.cachedData.dtf) {
            this.renderDTF();
        }
    }

    // =========================================================
    // EMBROIDERY
    // =========================================================

    async fetchEmbroidery(cost) {
        // generateManualPricingData() already calls calculatePricing() + transformToExistingFormat()
        // Returns fully transformed data — do NOT call calculatePricing() again
        const data = await this.services.emb.generateManualPricingData(cost);
        this.cachedData.emb = data;
        this.renderEmbroidery();
    }

    renderEmbroidery() {
        const data = this.cachedData.emb;
        if (!data) return;

        const { pricing, uniqueSizes, tierData } = data;
        const rows = [];

        tierData.forEach(tier => {
            const tierLabel = tier.TierLabel;
            const tierPrices = pricing[tierLabel];
            if (!tierPrices) return;

            const isLTM = tierLabel === '1-7';
            const sizePrices = {};
            uniqueSizes.forEach(size => {
                sizePrices[size] = tierPrices[size];
            });

            rows.push({
                label: tierLabel,
                isLTM: isLTM,
                prices: sizePrices
            });
        });

        this.renderPricingTable('embBody', uniqueSizes, rows, {
            ltmNote: '1-7 tier prices include $50 LTM fee distributed per piece'
        });
    }

    // =========================================================
    // CAP EMBROIDERY
    // =========================================================

    async fetchCapEmbroidery(cost) {
        // generateManualPricingData() already calls calculatePricing() + transformToExistingFormat()
        // Returns fully transformed data — do NOT call calculatePricing() again
        const data = await this.services.capEmb.generateManualPricingData(cost);
        this.cachedData.capEmb = data;
        this.renderCapEmbroidery();
    }

    renderCapEmbroidery() {
        const data = this.cachedData.capEmb;
        if (!data) return;

        const { pricing, uniqueSizes, tierData } = data;
        const rows = [];

        tierData.forEach(tier => {
            const tierLabel = tier.TierLabel;
            const tierPrices = pricing[tierLabel];
            if (!tierPrices) return;

            const isLTM = tierLabel === '1-7';
            const sizePrices = {};
            uniqueSizes.forEach(size => {
                sizePrices[size] = tierPrices[size];
            });

            rows.push({
                label: tierLabel,
                isLTM: isLTM,
                prices: sizePrices
            });
        });

        this.renderPricingTable('capEmbBody', uniqueSizes, rows, {
            ltmNote: '1-7 tier prices include $50 LTM fee distributed per piece'
        });
    }

    // =========================================================
    // SCREEN PRINT
    // =========================================================

    async fetchScreenPrint(cost) {
        const data = await this.services.sp.generateManualPricingData(cost);
        this.cachedData.sp = data;

        // Populate color dropdown
        const select = document.getElementById('spColors');
        if (select.options.length === 0 && data.availableColorCounts) {
            data.availableColorCounts.forEach(count => {
                const opt = document.createElement('option');
                opt.value = count;
                opt.textContent = count === 1 ? '1 Color' : `${count} Colors`;
                select.appendChild(opt);
            });
        }

        this.renderScreenPrint();
    }

    renderScreenPrint() {
        const data = this.cachedData.sp;
        if (!data || !data.finalPrices) return;

        const colorCount = document.getElementById('spColors').value || '1';
        const primaryPrices = data.finalPrices.PrimaryLocation;
        const uniqueSizes = data.uniqueSizes || [];

        const rows = [];
        const tierLabels = Object.keys(primaryPrices);

        tierLabels.forEach(tierLabel => {
            const colorPrices = primaryPrices[tierLabel][colorCount];
            if (!colorPrices) return;

            // Check if this tier has LTM
            const tierData = data.tierData && data.tierData[tierLabel];
            const isLTM = tierData && tierData.LTM_Fee > 0;

            const sizePrices = {};
            uniqueSizes.forEach(size => {
                sizePrices[size] = colorPrices[size];
            });

            rows.push({
                label: tierLabel,
                isLTM: isLTM,
                prices: sizePrices
            });
        });

        const ltmTier = data.tierData && Object.values(data.tierData).find(t => t.LTM_Fee > 0);
        const ltmAmount = ltmTier ? `$${ltmTier.LTM_Fee}` : '$50';

        this.renderPricingTable('spBody', uniqueSizes, rows, {
            ltmNote: `Orders in LTM tiers incur a ${ltmAmount} fee`
        });
    }

    onSPColorChange() {
        if (this.cachedData.sp) {
            this.renderScreenPrint();
        }
    }

    // =========================================================
    // SHARED TABLE RENDERER
    // =========================================================

    renderPricingTable(bodyId, sizeLabels, rows, options = {}) {
        const body = document.getElementById(bodyId);
        if (!body) return;

        if (rows.length === 0) {
            body.innerHTML = '<div class="card-error"><i class="fas fa-exclamation-circle"></i> No pricing data available</div>';
            return;
        }

        const isSingle = options.singleColumn || sizeLabels.length === 1;
        const hasLTM = rows.some(r => r.isLTM);

        let html = '<div class="pricing-table-wrapper"><table class="pricing-table">';

        // Header row
        html += '<thead><tr><th>Qty</th>';
        if (isSingle) {
            html += '<th>Sell Price</th>';
        } else {
            sizeLabels.forEach(size => {
                html += `<th>${escapeHtml(size)}</th>`;
            });
        }
        html += '</tr></thead>';

        // Body rows
        html += '<tbody>';
        rows.forEach(row => {
            const ltmClass = row.isLTM ? ' ltm-row' : '';
            html += `<tr class="${ltmClass}">`;
            html += `<td>${escapeHtml(row.label)}`;
            if (row.isLTM) {
                html += ' <span class="ltm-badge">LTM</span>';
            }
            html += '</td>';

            if (isSingle) {
                const key = Object.keys(row.prices)[0];
                const price = row.prices[key];
                html += `<td class="price-cell">${this.formatPrice(price)}</td>`;
            } else {
                sizeLabels.forEach(size => {
                    const price = row.prices[size];
                    html += `<td class="price-cell">${this.formatPrice(price)}</td>`;
                });
            }

            html += '</tr>';
        });
        html += '</tbody></table></div>';

        // LTM note
        if (hasLTM && options.ltmNote) {
            html += `<div class="ltm-note"><i class="fas fa-info-circle"></i> ${escapeHtml(options.ltmNote)}</div>`;
        }

        body.innerHTML = html;
    }

    // =========================================================
    // UI HELPERS
    // =========================================================

    formatPrice(price) {
        if (price === null || price === undefined || isNaN(price)) return 'N/A';
        return '$' + parseFloat(price).toFixed(2);
    }

    showLoading(bodyId) {
        const el = document.getElementById(bodyId);
        if (el) {
            el.innerHTML = '<div class="card-loading"><div class="spinner"></div> Loading pricing...</div>';
        }
    }

    showCardError(bodyId, message) {
        const el = document.getElementById(bodyId);
        if (el) {
            el.innerHTML = `<div class="card-error"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(message)}</div>`;
        }
    }

    showInputError(message) {
        const errDiv = document.getElementById('inputError');
        const errText = document.getElementById('inputErrorText');
        errText.textContent = message;
        errDiv.classList.add('visible');
    }

    hideInputError() {
        document.getElementById('inputError').classList.remove('visible');
    }
}

// XSS-safe HTML escaping
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
}

// Initialize on load
let manualCalc;
document.addEventListener('DOMContentLoaded', () => {
    manualCalc = new ManualPricingCalculator();
});
