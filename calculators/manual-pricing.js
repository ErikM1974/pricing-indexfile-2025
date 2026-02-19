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

        // Reset DTG secondary location
        document.getElementById('dtgSecondLocation').checked = false;
        document.getElementById('dtgSecondLocationSelect').innerHTML = '';
        document.getElementById('dtgSecondLocationSelect').style.display = 'none';

        // Reset DTF secondary location
        document.getElementById('dtfSecondLocation').checked = false;
        document.getElementById('dtfSecondTransferSize').style.display = 'none';

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

        // PRIMARY dropdown: front locations only
        const select = document.getElementById('dtgLocation');
        if (select.options.length === 0) {
            const locations = data.pricing.locations || this.services.dtg.locations || [];
            const frontLocs = locations.filter(loc =>
                !loc.code.includes('_') && !loc.name.toLowerCase().includes('back')
            );
            frontLocs.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc.code;
                opt.textContent = loc.name;
                select.appendChild(opt);
            });
        }

        // SECONDARY dropdown: back locations only
        const secondSelect = document.getElementById('dtgSecondLocationSelect');
        if (secondSelect.options.length === 0) {
            const locations = data.pricing.locations || this.services.dtg.locations || [];
            const backLocs = locations.filter(loc =>
                !loc.code.includes('_') && loc.name.toLowerCase().includes('back')
            );
            backLocs.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc.code;
                opt.textContent = loc.name;
                secondSelect.appendChild(opt);
            });
        }

        this.renderDTG();
    }

    renderDTG() {
        const data = this.cachedData.dtg;
        if (!data) return;

        const { sizes } = data.pricing;
        const sizeLabels = sizes.map(s => s.size);
        const ltmQty = parseInt(document.getElementById('dtgLtmQty')?.value || 12);
        const ltmPerUnit = Math.floor((50 / ltmQty) * 100) / 100;

        const primaryCode = document.getElementById('dtgLocation').value || 'LC';
        const secondEnabled = document.getElementById('dtgSecondLocation')?.checked || false;
        const secondCode = document.getElementById('dtgSecondLocationSelect')?.value || '';
        const locationCode = secondEnabled && secondCode ? `${primaryCode}_${secondCode}` : primaryCode;

        const tierRows = this.services.dtg.calculateAllTierPricesForLocation(data.pricing, locationCode);
        const rows = tierRows.map(row => ({
            label: row.label,
            isLTM: row.isLTM,
            ltmPerUnit: row.isLTM ? ltmPerUnit : 0,
            prices: Object.fromEntries(
                Object.entries(row.basePrices).map(([size, price]) => [
                    size, price + (row.isLTM ? ltmPerUnit : 0)
                ])
            )
        }));

        this.renderPricingTable('dtgBody', sizeLabels, rows, {
            ltmNote: `1-23 prices include $50 LTM fee (${ltmQty} pcs). Tiers 24+ are standard pricing (no LTM).`
        });
    }

    onDTGLocationChange() {
        if (this.cachedData.dtg) {
            this.renderDTG();
        }
    }

    onDTGLtmQtyChange() {
        if (this.cachedData.dtg) this.renderDTG();
    }

    onDTGSecondLocationChange() {
        const enabled = document.getElementById('dtgSecondLocation').checked;
        const secondEl = document.getElementById('dtgSecondLocationSelect');
        if (secondEl) secondEl.style.display = enabled ? '' : 'none';
        if (this.cachedData.dtg) this.renderDTG();
    }

    onDTGSecondLocationSelectChange() {
        if (this.cachedData.dtg) this.renderDTG();
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

        const secondEnabled = document.getElementById('dtfSecondLocation')?.checked || false;
        const secondSizeKey = document.getElementById('dtfSecondTransferSize')?.value || 'medium';
        const ltmQty = parseInt(document.getElementById('dtfLtmQty')?.value || 12);

        const tierRows = this.services.dtf.calculateAllTierPrices(
            this.currentCost, data, sizeKey, secondEnabled ? secondSizeKey : null
        );
        const rows = tierRows.map(row => {
            const ltmPerUnit = row.isLTM ? Math.floor((row.ltmFee / ltmQty) * 100) / 100 : 0;
            return {
                label: row.label,
                isLTM: row.isLTM,
                ltmPerUnit,
                prices: { 'Price': row.basePrice + ltmPerUnit }
            };
        });

        this.renderPricingTable('dtfBody', ['Price'], rows, {
            ltmNote: `10-23 prices include $50 LTM fee (${ltmQty} pcs). Tiers 24+ are standard pricing (no LTM).`,
            singleColumn: true
        });
    }

    onDTFSizeChange() {
        if (this.cachedData.dtf) {
            this.renderDTF();
        }
    }

    onDTFLtmQtyChange() {
        if (this.cachedData.dtf) this.renderDTF();
    }

    onDTFSecondLocationChange() {
        const enabled = document.getElementById('dtfSecondLocation').checked;
        const sizeEl = document.getElementById('dtfSecondTransferSize');
        if (sizeEl) sizeEl.style.display = enabled ? '' : 'none';
        if (this.cachedData.dtf) this.renderDTF();
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
        const ltmQty = parseInt(document.getElementById('embLtmQty')?.value || 3);
        const LTM_FEE = 50;
        const ltmPerUnit = LTM_FEE / ltmQty;

        // Sort tiers by MinQuantity (API may return them in non-sequential order)
        const sortedTierData = [...tierData].sort((a, b) =>
            (a.MinQuantity || 0) - (b.MinQuantity || 0)
        );

        const rows = [];
        sortedTierData.forEach(tier => {
            const tierLabel = tier.TierLabel;
            const tierPrices = pricing[tierLabel];
            if (!tierPrices) return;

            const isLTM = tierLabel === '1-7';
            const sizePrices = {};
            uniqueSizes.forEach(size => {
                let price = tierPrices[size];
                if (isLTM && price != null) {
                    price += ltmPerUnit;
                    price = parseFloat(price.toFixed(2));
                }
                sizePrices[size] = price;
            });

            rows.push({
                label: tierLabel,
                isLTM: isLTM,
                ltmPerUnit: isLTM ? parseFloat(ltmPerUnit.toFixed(2)) : 0,
                prices: sizePrices
            });
        });

        this.renderPricingTable('embBody', uniqueSizes, rows, {
            ltmNote: `1-7 prices include $50 LTM fee (${ltmQty} pcs). Tiers 8+ are standard pricing (no LTM).`
        });
    }

    onEmbLTMQtyChange() {
        if (this.cachedData.emb) this.renderEmbroidery();
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
        const ltmQty = parseInt(document.getElementById('capEmbLtmQty')?.value || 3);
        const LTM_FEE = 50;
        const ltmPerUnit = LTM_FEE / ltmQty;

        // Sort tiers by MinQuantity
        const sortedTierData = [...tierData].sort((a, b) =>
            (a.MinQuantity || 0) - (b.MinQuantity || 0)
        );

        const rows = [];
        sortedTierData.forEach(tier => {
            const tierLabel = tier.TierLabel;
            const tierPrices = pricing[tierLabel];
            if (!tierPrices) return;

            const isLTM = tierLabel === '1-7';
            const sizePrices = {};
            uniqueSizes.forEach(size => {
                let price = tierPrices[size];
                if (isLTM && price != null) {
                    price += ltmPerUnit;
                    price = parseFloat(price.toFixed(2));
                }
                sizePrices[size] = price;
            });

            rows.push({
                label: tierLabel,
                isLTM: isLTM,
                ltmPerUnit: isLTM ? parseFloat(ltmPerUnit.toFixed(2)) : 0,
                prices: sizePrices
            });
        });

        this.renderPricingTable('capEmbBody', uniqueSizes, rows, {
            ltmNote: `1-7 prices include $50 LTM fee (${ltmQty} pcs). Tiers 8+ are standard pricing (no LTM).`
        });
    }

    onCapEmbLTMQtyChange() {
        if (this.cachedData.capEmb) this.renderCapEmbroidery();
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

        const ltmQty = parseInt(document.getElementById('spLtmQty')?.value || 36);
        const colorCount = document.getElementById('spColors').value || '1';
        const primaryPrices = data.finalPrices.PrimaryLocation;
        const uniqueSizes = data.uniqueSizes || [];

        // Determine which tier the selected qty falls into
        let matchingTierLabel = null;
        let matchingLtmFee = 0;
        if (data.tierData) {
            for (const [label, td] of Object.entries(data.tierData)) {
                if (ltmQty >= td.MinQuantity && ltmQty <= td.MaxQuantity && td.LTM_Fee > 0) {
                    matchingTierLabel = label;
                    matchingLtmFee = td.LTM_Fee;
                    break;
                }
            }
        }

        const ltmPerUnit = matchingLtmFee > 0
            ? Math.floor((matchingLtmFee / ltmQty) * 100) / 100
            : 0;

        const rows = [];
        const tierLabels = Object.keys(primaryPrices);

        tierLabels.forEach(tierLabel => {
            const colorPrices = primaryPrices[tierLabel][colorCount];
            if (!colorPrices) return;

            const tierInfo = data.tierData && data.tierData[tierLabel];
            const isLTM = tierInfo && tierInfo.LTM_Fee > 0;
            const isMatchingTier = tierLabel === matchingTierLabel;

            const sizePrices = {};
            uniqueSizes.forEach(size => {
                let price = colorPrices[size];
                if (isMatchingTier && price != null) {
                    price += ltmPerUnit;
                    price = parseFloat(price.toFixed(2));
                }
                sizePrices[size] = price;
            });

            rows.push({
                label: tierLabel,
                isLTM: isLTM,
                ltmPerUnit: isMatchingTier ? ltmPerUnit : 0,
                prices: sizePrices
            });
        });

        let ltmNote;
        if (matchingTierLabel && matchingLtmFee > 0) {
            ltmNote = `${matchingTierLabel} prices include $${matchingLtmFee} LTM fee (${ltmQty} pcs). Tiers 72+ are standard pricing (no LTM).`;
        } else {
            ltmNote = 'Tiers 72+ are standard pricing (no LTM).';
        }

        this.renderPricingTable('spBody', uniqueSizes, rows, { ltmNote });
    }

    onSPColorChange() {
        if (this.cachedData.sp) {
            this.renderScreenPrint();
        }
    }

    onSPLtmQtyChange() {
        if (this.cachedData.sp) this.renderScreenPrint();
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
                const ltmText = row.ltmPerUnit > 0
                    ? `LTM +$${row.ltmPerUnit.toFixed(2)}/ea`
                    : 'LTM';
                html += ` <span class="ltm-badge">${ltmText}</span>`;
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
