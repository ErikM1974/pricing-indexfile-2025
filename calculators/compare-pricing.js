/**
 * Compare Pricing Calculator — By SanMar Style Number
 * Looks up a SanMar product and shows decorated sell prices
 * across all methods (DTG, DTF, Embroidery, Cap Embroidery, Screen Print).
 *
 * Copy-modified from manual-pricing.js — same render methods,
 * different fetch layer (fetchPricingData instead of generateManualPricingData).
 */

class ComparePricingCalculator {
    constructor() {
        this.currentItemType = 'garment';
        this.currentCost = null;
        this.currentStyle = null;

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
        console.log('[ComparePricing] Calculator initialized');
    }

    // =========================================================
    // URL PARAMS & ITEM TYPE
    // =========================================================

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const style = params.get('style');

        if (style && style.trim()) {
            document.getElementById('styleInput').value = style.trim().toUpperCase();
            setTimeout(() => this.lookUp(), 100);
        }
    }

    setItemType(type) {
        this.currentItemType = type;

        // Show/hide card groups
        document.getElementById('garmentCards').style.display = type === 'garment' ? 'block' : 'none';
        document.getElementById('capCards').style.display = type === 'cap' ? 'block' : 'none';
    }

    // =========================================================
    // PRODUCT INFO FETCH
    // =========================================================

    /**
     * Fetches product info from DTG product-bundle endpoint.
     * Returns product name, brand, category, sizes with SanMar prices.
     * Also extracts base cost and auto-detects garment/cap.
     */
    async fetchProductInfo(styleNumber) {
        const apiBase = this.services.dtg.apiBase;
        const url = `${apiBase}/dtg/product-bundle?styleNumber=${encodeURIComponent(styleNumber)}`;

        console.log('[ComparePricing] Fetching product info:', url);

        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Style "${styleNumber}" not found in SanMar catalog`);
            }
            throw new Error(`Product lookup failed (${response.status})`);
        }

        const data = await response.json();

        // Extract product info
        const product = data.product || {};
        const pricing = data.pricing || data;
        const sizes = pricing.sizes || data.sizes || [];

        // Get base cost (minimum size price)
        const prices = sizes.map(s => parseFloat(s.price || s.maxCasePrice)).filter(p => p > 0);
        if (prices.length === 0) {
            throw new Error(`No pricing data found for style "${styleNumber}"`);
        }
        const baseCost = Math.min(...prices);

        // Auto-detect garment vs cap
        const category = (product.CATEGORY_NAME || product.categoryName || '').toLowerCase();
        const title = (product.PRODUCT_TITLE || product.productTitle || product.name || '').toLowerCase();
        const isCap = category.includes('cap') || category.includes('headwear') ||
                       category.includes('hat') || category.includes('beanie') ||
                       category.includes('visor') ||
                       title.includes(' cap') || title.includes(' hat') ||
                       title.includes('beanie') || title.includes('visor');

        return {
            name: product.PRODUCT_TITLE || product.productTitle || product.name || styleNumber,
            brand: product.BRAND_NAME || product.brandName || product.brand || '',
            category: product.CATEGORY_NAME || product.categoryName || '',
            baseCost: baseCost,
            isCap: isCap,
            sizeCount: sizes.length
        };
    }

    renderProductInfo(info, styleNumber) {
        const banner = document.getElementById('productInfoBanner');
        document.getElementById('productName').textContent = `${styleNumber} — ${info.name}`;

        const badge = document.getElementById('itemTypeBadge');
        badge.textContent = info.isCap ? 'Cap' : 'Garment';
        badge.className = 'item-type-badge ' + (info.isCap ? 'cap' : 'garment');

        document.getElementById('productBrand').innerHTML =
            `<i class="fas fa-tag"></i> ${escapeHtml(info.brand)}`;
        document.getElementById('productCategory').innerHTML =
            `<i class="fas fa-folder"></i> ${escapeHtml(info.category)}`;
        document.getElementById('productBasePrice').innerHTML =
            `<i class="fas fa-dollar-sign"></i> Base cost: $${info.baseCost.toFixed(2)}`;

        banner.style.display = 'block';
    }

    hideProductInfo() {
        document.getElementById('productInfoBanner').style.display = 'none';
    }

    // =========================================================
    // MAIN LOOK UP
    // =========================================================

    async lookUp() {
        const input = document.getElementById('styleInput');
        const style = (input.value || '').trim().toUpperCase();

        // Validate
        if (!style) {
            this.showInputError('Please enter a SanMar style number');
            return;
        }
        if (style.length < 2) {
            this.showInputError('Style number is too short');
            return;
        }

        this.hideInputError();
        this.hideProductInfo();
        this.currentStyle = style;

        // Reset cached data and dropdowns for new style
        this.cachedData = { dtg: null, dtf: null, emb: null, capEmb: null, sp: null };
        document.getElementById('dtgLocation').innerHTML = '';
        document.getElementById('spColors').innerHTML = '';

        // Step 1: Fetch product info to get base cost and auto-detect type
        let productInfo;
        try {
            productInfo = await this.fetchProductInfo(style);
        } catch (error) {
            console.error('[ComparePricing] Product info fetch failed:', error);
            this.showInputError(error.message || `Unable to find style "${style}"`);
            return;
        }

        // Step 2: Render product info and set type
        this.renderProductInfo(productInfo, style);
        this.currentCost = productInfo.baseCost;
        this.setItemType(productInfo.isCap ? 'cap' : 'garment');

        // Step 3: Show cards and fetch pricing
        document.getElementById('methodCards').style.display = 'block';

        if (this.currentItemType === 'garment') {
            this.showLoading('dtgBody');
            this.showLoading('dtfBody');
            this.showLoading('embBody');
            this.showLoading('spBody');

            const results = await Promise.allSettled([
                this.fetchDTG(style),
                this.fetchDTF(style),
                this.fetchEmbroidery(style),
                this.fetchScreenPrint(style)
            ]);

            this.handleResult(results[0], 'dtgBody', 'DTG');
            this.handleResult(results[1], 'dtfBody', 'DTF');
            this.handleResult(results[2], 'embBody', 'Embroidery');
            this.handleResult(results[3], 'spBody', 'Screen Print');

        } else {
            this.showLoading('capEmbBody');

            const results = await Promise.allSettled([
                this.fetchCapEmbroidery(style)
            ]);

            this.handleResult(results[0], 'capEmbBody', 'Cap Embroidery');
        }
    }

    handleResult(result, bodyId, methodName) {
        if (result.status === 'rejected') {
            console.error(`[ComparePricing] ${methodName} failed:`, result.reason);
            this.showCardError(bodyId, `Unable to load ${methodName} pricing. Please refresh.`);
        }
    }

    // =========================================================
    // DTG
    // =========================================================

    async fetchDTG(style) {
        const data = await this.services.dtg.fetchPricingData(style);
        // Normalize: fetchPricingData returns flat { tiers, costs, sizes, ... }
        // but renderDTG() expects data.pricing.* wrapper
        this.cachedData.dtg = { pricing: data };

        // Populate location dropdown from data
        const select = document.getElementById('dtgLocation');
        if (select.options.length === 0) {
            const locations = data.locations || this.services.dtg.locations || [];
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

    async fetchDTF(style) {
        const data = await this.services.dtf.fetchPricingData(style);
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
            const repQty = transferTier.minQty;
            const marginTier = data.pricingTiers.find(t =>
                repQty >= t.minQuantity && repQty <= t.maxQuantity
            );
            const marginDenom = marginTier ? marginTier.marginDenominator : 0.57;

            const freightTier = data.freightTiers.find(t =>
                repQty >= t.minQty && repQty <= t.maxQty
            );
            const freight = freightTier ? freightTier.costPerTransfer : 0;

            // Use base cost from product info for garment markup
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

    async fetchEmbroidery(style) {
        // fetchPricingData() calls calculatePricing() + transformToExistingFormat()
        // Returns same shape as generateManualPricingData()
        const data = await this.services.emb.fetchPricingData(style);
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

    async fetchCapEmbroidery(style) {
        // fetchPricingData() calls calculatePricing() + transformToExistingFormat()
        // Returns same shape as generateManualPricingData()
        const data = await this.services.capEmb.fetchPricingData(style);
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

    async fetchScreenPrint(style) {
        const data = await this.services.sp.fetchPricingData(style);
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
let compareCalc;
document.addEventListener('DOMContentLoaded', () => {
    compareCalc = new ComparePricingCalculator();
});
