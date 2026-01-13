/**
 * Quote View Page JavaScript
 * Professional customer-facing quote display with size matrix and sales tax
 * Matches PDF invoice format from EmbroideryInvoiceGenerator
 */

class QuoteViewPage {
    constructor() {
        this.quoteId = null;
        this.quoteData = null;
        this.items = [];
        this.taxRate = 0.101; // 10.1% WA Sales Tax

        // Quote type mapping
        this.quoteTypes = {
            'DTG': 'Direct-to-Garment',
            'DTF': 'Direct-to-Film',
            'EMB': 'Embroidery',
            'EMBC': 'Customer Supplied Embroidery',
            'SPC': 'Screen Print',
            'SP': 'Screen Print',
            'RICH': 'Richardson Caps',
            'CAP': 'Cap Embroidery',
            'LT': 'Laser Tumblers',
            'PATCH': 'Embroidered Emblems'
        };

        // DTF Location configuration
        this.locationConfig = {
            'LC': { label: 'Left Chest', size: 'Small' },
            'RC': { label: 'Right Chest', size: 'Small' },
            'LS': { label: 'Left Sleeve', size: 'Small' },
            'RS': { label: 'Right Sleeve', size: 'Small' },
            'BN': { label: 'Back of Neck', size: 'Small' },
            'CF': { label: 'Center Front', size: 'Medium' },
            'CB': { label: 'Center Back', size: 'Medium' },
            'FF': { label: 'Full Front', size: 'Large' },
            'FB': { label: 'Full Back', size: 'Large' }
        };

        // Size order for display
        this.sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

        // Standard vs extended size groups
        this.standardSizes = ['XS', 'S', 'M', 'L', 'XL'];
        this.extendedSizes = ['2XL', '3XL', '4XL', '5XL', '6XL'];

        // Extended size upcharges (added to base price)
        this.sizeUpcharges = {
            'XS': 0, 'S': 0, 'M': 0, 'L': 0, 'XL': 0,
            '2XL': 2, '3XL': 4, '4XL': 6, '5XL': 8, '6XL': 10
        };

        // Cache for product images
        this.imageCache = {};

        // API base URL for product details
        this.apiBaseUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        this.init();
    }

    async init() {
        // Get quote ID from URL
        this.quoteId = this.getQuoteIdFromUrl();

        if (!this.quoteId) {
            this.showError('Invalid quote URL');
            return;
        }

        // Set current year in footer
        document.getElementById('current-year').textContent = new Date().getFullYear();

        // Load quote data
        await this.loadQuote();

        // Setup event listeners
        this.setupEventListeners();
    }

    getQuoteIdFromUrl() {
        const path = window.location.pathname;
        // Match multiple formats: DTF0112-1 or DTF-1768263686415
        const match = path.match(/\/quote\/([A-Z]{2,5}[-\d]+)/);
        return match ? match[1] : null;
    }

    async loadQuote() {
        try {
            const response = await fetch(`/api/public/quote/${this.quoteId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    this.showError('Quote not found');
                } else {
                    throw new Error('Failed to load quote');
                }
                return;
            }

            const data = await response.json();
            this.quoteData = data.session;
            this.items = data.items || [];

            console.log('[QuoteView] Loaded quote data:', this.quoteData);
            console.log('[QuoteView] Loaded items:', this.items);

            await this.renderQuote();
            this.showContent();

        } catch (error) {
            console.error('Error loading quote:', error);
            this.showError('Unable to load quote. Please try again later.');
        }
    }

    async renderQuote() {
        // Header
        document.getElementById('quote-id-header').textContent = `Quote #${this.quoteId}`;

        // Status
        this.renderStatus();

        // Customer info
        document.getElementById('customer-name').textContent = this.quoteData.CustomerName || 'N/A';
        document.getElementById('company-name').textContent = this.quoteData.CompanyName || '';
        document.getElementById('customer-email').textContent = this.quoteData.CustomerEmail || '';
        document.getElementById('customer-phone').textContent = this.formatPhone(this.quoteData.Phone) || '';

        // Quote details
        document.getElementById('quote-type').textContent = this.getQuoteType();
        document.getElementById('created-date').textContent = this.formatDate(this.quoteData.CreatedAt);
        document.getElementById('expires-date').textContent = this.formatDate(this.quoteData.ExpiresAt);

        // Check expiration
        if (this.isExpired()) {
            document.getElementById('expired-banner').style.display = 'flex';
            document.getElementById('accept-quote-btn').disabled = true;
            document.getElementById('accept-quote-btn').title = 'Quote has expired';
        }

        // Check if accepted
        if (this.quoteData.Status === 'Accepted') {
            this.showAcceptedState();
        }

        // Render DTF specs section if applicable
        this.renderDTFSpecs();

        // Items - render as product cards with size matrix (async for image fetching)
        await this.renderItems();

        // Totals with tax
        this.renderTotals();

        // Modal totals
        const totalWithTax = this.calculateTotalWithTax();
        document.getElementById('modal-total').textContent = this.formatCurrency(totalWithTax);
        document.getElementById('modal-expires').textContent = this.formatDate(this.quoteData.ExpiresAt);
    }

    renderStatus() {
        const statusEl = document.getElementById('quote-status');
        let statusClass = 'status-open';
        let statusText = 'Open';

        if (this.quoteData.Status === 'Accepted') {
            statusClass = 'status-accepted';
            statusText = 'Accepted';
        } else if (this.isExpired()) {
            statusClass = 'status-expired';
            statusText = 'Expired';
        } else if (this.quoteData.FirstViewedAt) {
            statusClass = 'status-viewed';
            statusText = 'Viewed';
        }

        statusEl.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
    }

    /**
     * Render DTF transfer location specifications
     */
    renderDTFSpecs() {
        // Parse Notes JSON to get location info
        let notes = {};
        try {
            notes = this.quoteData.Notes ? JSON.parse(this.quoteData.Notes) : {};
        } catch (e) {
            console.warn('Could not parse Notes JSON:', e);
        }

        // Check if we have location data
        const locationCodes = notes.locationCodes || '';
        const locationNames = notes.locationNames || '';

        if (!locationCodes && !locationNames) {
            return; // No location data to display
        }

        // Get the DTF specs section from HTML
        const specsSection = document.getElementById('dtf-specs-section');
        const specsContainer = document.getElementById('dtf-specs-container');

        if (!specsSection || !specsContainer) {
            console.warn('DTF specs section not found in HTML');
            return;
        }

        // Show the section and populate it
        specsSection.style.display = 'block';
        specsContainer.innerHTML = this.renderLocationList(locationCodes, locationNames, notes);
    }

    renderLocationList(locationCodes, locationNames, notes) {
        // Parse ALL location codes from underscore-separated string (e.g., 'LC_FB' -> ['LC', 'FB'])
        if (locationCodes) {
            const codes = locationCodes.split('_');
            return codes.map(code => {
                const config = this.locationConfig[code] || { label: code, size: 'Unknown' };
                return `<div class="dtf-location-item">• ${config.label} <span class="dtf-location-size">(${config.size})</span></div>`;
            }).join('');
        }

        // Fallback to locationNames - handle " + " separator
        if (locationNames) {
            const names = locationNames.split(' + ');
            return names.map(name => `<div class="dtf-location-item">• ${name.trim()}</div>`).join('');
        }

        return '';
    }

    /**
     * Fetch product image from product-details API
     * Returns the FRONT_MODEL image URL for the matching color
     */
    async fetchProductImage(styleNumber, colorName) {
        if (!styleNumber) return '';

        // Check cache first
        const cacheKey = `${styleNumber}-${colorName}`;
        if (this.imageCache[cacheKey]) {
            return this.imageCache[cacheKey];
        }

        try {
            const response = await fetch(
                `${this.apiBaseUrl}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`
            );

            if (!response.ok) {
                console.warn(`[QuoteView] Failed to fetch product details for ${styleNumber}`);
                return '';
            }

            const colors = await response.json();
            if (!Array.isArray(colors) || colors.length === 0) {
                console.warn(`[QuoteView] No color data returned for ${styleNumber}`);
                return '';
            }

            // Find matching color (try various matching strategies)
            const colorLower = (colorName || '').toLowerCase().replace(/\s+/g, '');
            let match = colors.find(c => {
                const name = (c.COLOR_NAME || '').toLowerCase().replace(/\s+/g, '');
                const catalog = (c.CATALOG_COLOR || '').toLowerCase().replace(/\s+/g, '');
                return name === colorLower || catalog === colorLower;
            });

            // Try partial match if exact match fails
            if (!match) {
                match = colors.find(c => {
                    const name = (c.COLOR_NAME || '').toLowerCase().replace(/\s+/g, '');
                    const catalog = (c.CATALOG_COLOR || '').toLowerCase().replace(/\s+/g, '');
                    return name.includes(colorLower) || colorLower.includes(name) ||
                           catalog.includes(colorLower) || colorLower.includes(catalog);
                });
            }

            // Return best image (prefer FRONT_MODEL, fallback to first color)
            const imageUrl = match?.FRONT_MODEL || match?.FRONT_FLAT ||
                           colors[0]?.FRONT_MODEL || colors[0]?.FRONT_FLAT || '';

            // Cache the result
            this.imageCache[cacheKey] = imageUrl;

            console.log(`[QuoteView] Fetched image for ${styleNumber} ${colorName}: ${imageUrl ? 'Found' : 'Not found'}`);
            return imageUrl;

        } catch (error) {
            console.error(`[QuoteView] Error fetching product image for ${styleNumber}:`, error);
            return '';
        }
    }

    /**
     * Render items as product cards with size matrix tables
     * Fetches product images from API for each product
     */
    async renderItems() {
        const container = document.getElementById('items-container');

        if (!this.items || this.items.length === 0) {
            container.innerHTML = '<p class="no-items">No items in this quote</p>';
            return;
        }

        // Group items by StyleNumber + Color
        const productGroups = this.groupItemsByProduct();
        const groups = Object.values(productGroups);

        // Render cards - images will be loaded async and updated
        container.innerHTML = groups.map((group, index) =>
            this.renderProductCard(group, index)
        ).join('');

        // Fetch and update images for each product (async)
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const imageUrl = await this.fetchProductImage(group.styleNumber, group.color);

            if (imageUrl) {
                const imgElement = container.querySelector(`#product-image-${i}`);
                if (imgElement) {
                    imgElement.src = imageUrl;
                    imgElement.onerror = function() {
                        this.parentElement.innerHTML = '<div class="product-image-placeholder">No Image</div>';
                    };
                }
            }
        }
    }

    /**
     * Group items by product (StyleNumber + Color)
     */
    groupItemsByProduct() {
        const groups = {};

        this.items.forEach(item => {
            // Use Color or ColorCode for grouping (some quotes have data in different fields)
            const colorForGrouping = item.Color || item.ColorCode || 'Unknown';
            const key = `${item.StyleNumber}-${colorForGrouping}`;
            if (!groups[key]) {
                groups[key] = {
                    styleNumber: item.StyleNumber,
                    productName: this.extractProductName(item.ProductName),
                    color: item.Color || item.ColorCode || 'N/A', // Fallback to ColorCode for display
                    colorCode: item.ColorCode || item.Color || '', // For image URL construction
                    imageUrl: item.ImageURL,
                    printLocation: item.PrintLocationName || item.PrintLocation,
                    embellishmentType: item.EmbellishmentType,
                    items: []
                };
            }
            groups[key].items.push(item);
        });

        return groups;
    }

    /**
     * Extract product name without color suffix
     */
    extractProductName(fullName) {
        if (!fullName) return '';
        // Remove " - ColorName" suffix if present
        const parts = fullName.split(' - ');
        return parts[0].trim();
    }

    /**
     * Render a product card with size matrix
     * @param {Object} productGroup - Product data grouped by style/color
     * @param {number} index - Index for image element ID
     */
    renderProductCard(productGroup, index = 0) {
        const productTotal = this.calculateProductTotal(productGroup);
        const totalQty = productGroup.items.reduce((sum, item) => sum + (parseInt(item.Quantity) || 0), 0);

        // Initial image - placeholder or stored URL, will be updated async
        const storedImageUrl = productGroup.imageUrl && productGroup.imageUrl.startsWith('http') ? productGroup.imageUrl : '';

        return `
            <div class="product-card">
                <div class="product-header">
                    <div class="product-image">
                        <img id="product-image-${index}"
                             src="${storedImageUrl || '/pages/images/product-placeholder.png'}"
                             alt="${this.escapeHtml(productGroup.styleNumber)}"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="product-image-placeholder" style="display: ${storedImageUrl ? 'none' : 'flex'};">
                            <span>Loading...</span>
                        </div>
                    </div>
                    <div class="product-info">
                        <div class="product-style">${this.escapeHtml(productGroup.styleNumber)}</div>
                        <div class="product-name">${this.escapeHtml(productGroup.productName)}</div>
                        <div class="product-color-badge">${this.escapeHtml(productGroup.color)}</div>
                    </div>
                    <div class="product-total">
                        <div class="product-total-label">${totalQty} pieces</div>
                        <div class="product-total-amount">${this.formatCurrency(productTotal)}</div>
                    </div>
                </div>
                ${this.renderSizeMatrix(productGroup)}
            </div>
        `;
    }

    /**
     * Get product image URL - try stored URL first, then construct SanMar URL
     */
    getProductImageUrl(productGroup) {
        // Try stored ImageURL first
        if (productGroup.imageUrl && productGroup.imageUrl.startsWith('http')) {
            return productGroup.imageUrl;
        }

        // Construct SanMar URL from style + color
        const styleNumber = productGroup.styleNumber;
        const colorCode = productGroup.colorCode || productGroup.color || '';

        if (!styleNumber || !colorCode) return '';

        // Clean up color code for URL
        const cleanColor = colorCode.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

        // SanMar image URL pattern
        return `https://cdnm.sanmar.com/imglib/mresjpg/2022/${styleNumber}/${styleNumber}_${cleanColor}_model_front_072022.jpg`;
    }

    /**
     * Render size matrix table for a product
     * Handles both new format (multiple items with stored prices) and legacy format
     */
    renderSizeMatrix(productGroup) {
        const rows = [];

        // Check if items have valid stored prices (new format)
        // New format: FinalUnitPrice is the selling price (e.g., $31, $33, etc.)
        // Legacy format: FinalUnitPrice is garment cost (e.g., $3.53)
        const hasValidStoredPrices = productGroup.items.some(item =>
            item.FinalUnitPrice && item.FinalUnitPrice > 10 && item.LineTotal > 0
        );

        if (hasValidStoredPrices || productGroup.items.length > 1) {
            // NEW FORMAT: Multiple items with stored prices - render each item directly
            productGroup.items.forEach(item => {
                const sizeBreakdown = this.parseSizeBreakdown(item.SizeBreakdown);
                const sizeLabel = Object.entries(sizeBreakdown)
                    .filter(([_, qty]) => qty > 0)
                    .sort((a, b) => this.sizeOrder.indexOf(a[0]) - this.sizeOrder.indexOf(b[0]))
                    .map(([size, qty]) => `${size}(${qty})`)
                    .join(' ');

                // Check if this is an extended size row
                const sizes = Object.keys(sizeBreakdown).filter(s => sizeBreakdown[s] > 0);
                const isExtended = sizes.some(s => this.extendedSizes.includes(s)) &&
                                   !sizes.some(s => this.standardSizes.includes(s));

                rows.push({
                    label: sizeLabel || `Qty: ${item.Quantity}`,
                    qty: item.Quantity,
                    unitPrice: item.FinalUnitPrice || 0,
                    total: item.LineTotal || (item.Quantity * item.FinalUnitPrice) || 0,
                    isExtended: isExtended
                });
            });
        } else {
            // LEGACY FORMAT: Single item with all sizes - calculate prices
            const sizeBreakdown = this.parseSizeBreakdown(productGroup.items[0]?.SizeBreakdown);

            // Standard sizes row (S-XL - same base price)
            const stdSizes = this.standardSizes.filter(s => sizeBreakdown[s] > 0);
            if (stdSizes.length > 0) {
                const stdQty = stdSizes.reduce((sum, s) => sum + (sizeBreakdown[s] || 0), 0);
                const stdPrice = this.getUnitPriceForSize('S');
                rows.push({
                    label: stdSizes.map(s => `${s}(${sizeBreakdown[s]})`).join(' '),
                    qty: stdQty,
                    unitPrice: stdPrice,
                    total: stdQty * stdPrice,
                    isExtended: false
                });
            }

            // Extended sizes - each size separately
            this.extendedSizes.forEach(size => {
                const qty = sizeBreakdown[size] || 0;
                if (qty > 0) {
                    const price = this.getUnitPriceForSize(size);
                    rows.push({
                        label: `${size}(${qty})`,
                        qty: qty,
                        unitPrice: price,
                        total: qty * price,
                        isExtended: true
                    });
                }
            });
        }

        if (rows.length === 0) {
            return this.renderSimpleItemList(productGroup.items);
        }

        // Build table HTML
        let html = '<table class="size-matrix">';
        html += '<thead><tr>';
        html += '<th class="sizes-col">Sizes</th>';
        html += '<th class="qty-col">Qty</th>';
        html += '<th class="price-col">Unit Price</th>';
        html += '<th class="total-col">Line Total</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        rows.forEach(row => {
            const rowClass = row.isExtended ? 'extended-row' : 'standard-row';
            html += `<tr class="${rowClass}">`;
            html += `<td class="sizes-col">${row.label}</td>`;
            html += `<td class="qty-col">${row.qty}</td>`;
            html += `<td class="price-col">${this.formatCurrency(row.unitPrice)}</td>`;
            html += `<td class="total-col">${this.formatCurrency(row.total)}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    /**
     * Render simple item list (fallback when no size breakdown)
     */
    renderSimpleItemList(items) {
        let html = '<table class="size-matrix"><thead><tr>';
        html += '<th style="text-align: left;">Description</th>';
        html += '<th class="qty-col">Qty</th>';
        html += '<th class="price-col">Unit Price</th>';
        html += '<th class="total-col">Total</th>';
        html += '</tr></thead><tbody>';

        items.forEach(item => {
            const sizeInfo = this.parseSizeBreakdown(item.SizeBreakdown);
            const sizeStr = Object.entries(sizeInfo)
                .filter(([_, qty]) => qty > 0)
                .map(([size, qty]) => `${size}(${qty})`)
                .join(' ') || `Qty: ${item.Quantity}`;

            html += `<tr>`;
            html += `<td style="text-align: left;">${sizeStr}</td>`;
            html += `<td class="qty-col">${item.Quantity || 0}</td>`;
            html += `<td class="price-col">${this.formatCurrency(item.FinalUnitPrice || item.BaseUnitPrice || 0)}</td>`;
            html += `<td class="total-col">${this.formatCurrency(item.LineTotal || 0)}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    /**
     * Parse size data from items array
     */
    parseSizeData(items) {
        const sizes = {};
        const pricing = {};

        items.forEach(item => {
            const breakdown = this.parseSizeBreakdown(item.SizeBreakdown);
            const unitPrice = item.FinalUnitPrice || item.BaseUnitPrice || 0;

            Object.entries(breakdown).forEach(([size, qty]) => {
                if (qty > 0) {
                    sizes[size] = (sizes[size] || 0) + qty;
                    pricing[size] = unitPrice;
                }
            });
        });

        return { sizes, pricing };
    }

    /**
     * Get the BASE selling price (standard sizes S-XL)
     * This is calculated from the session's SubtotalAmount / TotalQuantity
     */
    getBaseSellingPrice() {
        // If we have stored FinalUnitPrice on any item, try to find the lowest (base) price
        const itemsWithPrice = this.items.filter(i => i.FinalUnitPrice && i.FinalUnitPrice > 0);
        if (itemsWithPrice.length > 0) {
            return Math.min(...itemsWithPrice.map(i => i.FinalUnitPrice));
        }

        // Calculate from session's SubtotalAmount
        // This gives us an AVERAGE, but we need to estimate the BASE price
        if (this.quoteData.SubtotalAmount && this.quoteData.TotalQuantity) {
            const avgPrice = this.quoteData.SubtotalAmount / this.quoteData.TotalQuantity;

            // The average includes upcharges for extended sizes
            // Estimate the base price by subtracting weighted average upcharge
            const sizeBreakdown = this.items[0]?.SizeBreakdown;
            if (sizeBreakdown) {
                const breakdown = this.parseSizeBreakdown(sizeBreakdown);
                let totalQty = 0;
                let totalUpcharge = 0;

                Object.entries(breakdown).forEach(([size, qty]) => {
                    if (qty > 0) {
                        totalQty += qty;
                        totalUpcharge += qty * (this.sizeUpcharges[size] || 0);
                    }
                });

                if (totalQty > 0) {
                    const avgUpcharge = totalUpcharge / totalQty;
                    return avgPrice - avgUpcharge;
                }
            }

            return avgPrice;
        }

        // Last resort: this shows COST which is wrong, but better than nothing
        return this.items[0]?.BaseUnitPrice || 0;
    }

    /**
     * Get estimated unit price for a specific size category
     * Base selling price + size upcharge = final unit price
     */
    getEstimatedUnitPrice(item, sizeCategory = 'standard') {
        // If FinalUnitPrice is set and > 0, use it
        if (item.FinalUnitPrice && item.FinalUnitPrice > 0) {
            return item.FinalUnitPrice;
        }

        // Get base selling price and add upcharge for the size
        const basePrice = this.getBaseSellingPrice();
        const upcharge = this.sizeUpcharges[sizeCategory] || 0;

        return basePrice + upcharge;
    }

    /**
     * Get unit price for a specific size
     */
    getUnitPriceForSize(size) {
        const basePrice = this.getBaseSellingPrice();
        const upcharge = this.sizeUpcharges[size] || 0;
        return basePrice + upcharge;
    }

    /**
     * Group items by price (to show base sizes vs upcharged sizes)
     */
    groupByPrice(items) {
        const groups = [];
        const prices = items.map(i => this.getEstimatedUnitPrice(i));
        const basePrice = Math.min(...prices);

        items.forEach(item => {
            const unitPrice = this.getEstimatedUnitPrice(item);
            const hasUpcharge = unitPrice > basePrice && basePrice > 0;
            const quantity = parseInt(item.Quantity) || 0;
            const lineTotal = item.LineTotal && item.LineTotal > 0
                ? item.LineTotal
                : unitPrice * quantity;

            groups.push({
                sizeBreakdown: item.SizeBreakdown,
                quantity: quantity,
                unitPrice: unitPrice,
                total: lineTotal,
                hasUpcharge: hasUpcharge
            });
        });

        // Sort: base sizes first, then upcharged
        groups.sort((a, b) => (a.hasUpcharge ? 1 : 0) - (b.hasUpcharge ? 1 : 0));

        return groups;
    }

    /**
     * Get size label from breakdown (e.g., "2XL", "3XL-6XL")
     */
    getSizeLabel(breakdown) {
        const sizes = Object.keys(breakdown).filter(s => breakdown[s] > 0);
        if (sizes.length === 0) return 'Extended';
        if (sizes.length === 1) return sizes[0];
        return `${sizes[0]}-${sizes[sizes.length - 1]}`;
    }

    /**
     * Render price legend showing different prices for sizes
     */
    renderPriceLegend(productGroup) {
        // Check if there are different prices (using estimated price method)
        const prices = new Set(productGroup.items.map(i => this.getEstimatedUnitPrice(i)));
        if (prices.size <= 1) return '';

        const priceList = Array.from(prices).sort((a, b) => a - b);
        const basePrice = priceList[0];

        const legendParts = priceList.map((price, index) => {
            if (index === 0) {
                return `<strong>S-XL:</strong> ${this.formatCurrency(price)}`;
            } else {
                const upcharge = price - basePrice;
                return `<strong>Extended:</strong> ${this.formatCurrency(price)} (+$${upcharge.toFixed(0)})`;
            }
        });

        return `<div class="price-legend">Pricing: ${legendParts.join(' | ')}</div>`;
    }

    /**
     * Calculate total for a product group using size-based pricing
     */
    calculateProductTotal(productGroup) {
        const items = productGroup.items || productGroup;
        const item = Array.isArray(items) ? items[0] : items;

        if (!item) return 0;

        // If LineTotal is stored and > 0, use it
        if (item.LineTotal && item.LineTotal > 0) {
            return items.reduce((sum, i) => sum + (i.LineTotal || 0), 0);
        }

        // Calculate from size breakdown with per-size pricing
        const sizeBreakdown = this.parseSizeBreakdown(item.SizeBreakdown);
        let total = 0;

        Object.entries(sizeBreakdown).forEach(([size, qty]) => {
            if (qty > 0) {
                const unitPrice = this.getUnitPriceForSize(size);
                total += qty * unitPrice;
            }
        });

        return total;
    }

    /**
     * Calculate total with tax
     */
    calculateTotalWithTax() {
        const subtotal = parseFloat(this.quoteData.TotalAmount) || 0;
        const taxAmount = subtotal * this.taxRate;
        return subtotal + taxAmount;
    }

    /**
     * Render totals section with tax
     */
    renderTotals() {
        const subtotal = parseFloat(this.quoteData.SubtotalAmount) || 0;
        const ltmFee = parseFloat(this.quoteData.LTMFeeTotal) || 0;
        const grandTotalBeforeTax = parseFloat(this.quoteData.TotalAmount) || 0;
        const taxAmount = grandTotalBeforeTax * this.taxRate;
        const totalWithTax = grandTotalBeforeTax + taxAmount;

        // Build totals HTML
        const totalsCard = document.querySelector('.totals-card');
        let totalsHtml = '';

        totalsHtml += `
            <div class="total-row">
                <span class="label">Subtotal:</span>
                <span class="value">${this.formatCurrency(subtotal)}</span>
            </div>
        `;

        if (ltmFee > 0) {
            totalsHtml += `
                <div class="total-row">
                    <span class="label">Less Than Minimum Fee:</span>
                    <span class="value">${this.formatCurrency(ltmFee)}</span>
                </div>
            `;
        }

        // Add tax row
        totalsHtml += `
            <div class="total-row tax-row">
                <span class="label">WA Sales Tax (10.1%):</span>
                <span class="value">${this.formatCurrency(taxAmount)}</span>
            </div>
        `;

        // Grand total with tax
        totalsHtml += `
            <div class="total-row grand-total">
                <span class="label">TOTAL:</span>
                <span class="value">${this.formatCurrency(totalWithTax)}</span>
            </div>
        `;

        // Total quantity
        totalsHtml += `<p class="total-quantity">Total items: ${this.quoteData.TotalQuantity || this.items.reduce((sum, i) => sum + (i.Quantity || 0), 0)}</p>`;

        totalsCard.innerHTML = totalsHtml;
    }

    showAcceptedState() {
        // Show accepted banner
        const acceptedBanner = document.getElementById('accepted-banner');
        acceptedBanner.style.display = 'flex';

        // Parse acceptance info from Notes JSON (since Caspio doesn't have AcceptedAt field)
        let acceptedDate = '';
        let acceptedBy = '';

        try {
            const notes = JSON.parse(this.quoteData.Notes || '{}');
            acceptedDate = notes.acceptedAt ? this.formatDate(notes.acceptedAt) : '';
            acceptedBy = notes.acceptedByName || '';
        } catch (e) {
            console.error('Error parsing Notes JSON for acceptance info:', e);
        }

        const acceptedInfo = document.getElementById('accepted-info');
        acceptedInfo.textContent = `Accepted on ${acceptedDate}${acceptedBy ? ` by ${acceptedBy}` : ''}`;

        // Hide accept button
        document.getElementById('accept-quote-btn').style.display = 'none';
    }

    // Event Listeners
    setupEventListeners() {
        // Download PDF
        document.getElementById('download-pdf-btn').addEventListener('click', () => this.downloadPdf());

        // Accept Quote
        document.getElementById('accept-quote-btn').addEventListener('click', () => this.openAcceptModal());

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => this.closeAcceptModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeAcceptModal());

        // Modal accept
        document.getElementById('modal-accept').addEventListener('click', () => this.acceptQuote());

        // Success close
        document.getElementById('success-close').addEventListener('click', () => this.closeSuccessModal());

        // Close modal on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                this.closeAcceptModal();
                this.closeSuccessModal();
            });
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAcceptModal();
                this.closeSuccessModal();
            }
        });
    }

    // Modal Methods
    openAcceptModal() {
        if (this.isExpired()) {
            alert('This quote has expired. Please contact us for updated pricing.');
            return;
        }

        if (this.quoteData.Status === 'Accepted') {
            alert('This quote has already been accepted.');
            return;
        }

        // Pre-fill email if available
        const emailInput = document.getElementById('accept-email');
        if (this.quoteData.CustomerEmail) {
            emailInput.value = this.quoteData.CustomerEmail;
        }

        // Pre-fill name if available
        const nameInput = document.getElementById('accept-name');
        if (this.quoteData.CustomerName) {
            nameInput.value = this.quoteData.CustomerName;
        }

        document.getElementById('accept-modal').style.display = 'flex';
    }

    closeAcceptModal() {
        document.getElementById('accept-modal').style.display = 'none';
    }

    closeSuccessModal() {
        document.getElementById('success-modal').style.display = 'none';
    }

    async acceptQuote() {
        const nameInput = document.getElementById('accept-name');
        const emailInput = document.getElementById('accept-email');
        const acceptBtn = document.getElementById('modal-accept');
        const btnText = document.getElementById('accept-btn-text');
        const btnLoading = document.getElementById('accept-btn-loading');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        // Validation
        if (!name) {
            nameInput.focus();
            alert('Please enter your name');
            return;
        }

        if (!email || !this.isValidEmail(email)) {
            emailInput.focus();
            alert('Please enter a valid email address');
            return;
        }

        // Show loading state
        acceptBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';

        try {
            const response = await fetch(`/api/public/quote/${this.quoteId}/accept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to accept quote');
            }

            // Success
            this.closeAcceptModal();

            // Update quote data - store in Notes JSON to match server storage
            this.quoteData.Status = 'Accepted';
            try {
                const notes = JSON.parse(this.quoteData.Notes || '{}');
                notes.acceptedAt = data.acceptedAt;
                notes.acceptedByName = name;
                notes.acceptedByEmail = email;
                this.quoteData.Notes = JSON.stringify(notes);
            } catch (e) {
                console.error('Error updating Notes JSON:', e);
            }

            // Update UI
            this.renderStatus();
            this.showAcceptedState();

            // Show success modal
            document.getElementById('success-modal').style.display = 'flex';

        } catch (error) {
            console.error('Error accepting quote:', error);
            alert(error.message || 'Failed to accept quote. Please try again.');
        } finally {
            // Reset button state
            acceptBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }

    // PDF Generation
    async downloadPdf() {
        const btn = document.getElementById('download-pdf-btn');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<span>Generating PDF...</span>';
            btn.disabled = true;

            // Use jsPDF with html2canvas for better rendering
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'letter');

            // Generate PDF content
            this.generatePdfContent(pdf);

            // Download
            pdf.save(`Quote-${this.quoteId}.pdf`);

        } catch (error) {
            console.error('Error generating PDF:', error);
            // Fallback to print
            window.print();
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    generatePdfContent(pdf) {
        const pageWidth = 215.9; // Letter width in mm
        const margin = 20;
        let yPos = margin;

        // Header - green
        pdf.setFillColor(76, 179, 84); // #4cb354
        pdf.rect(0, 0, pageWidth, 35, 'F');

        // Company name
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Northwest Custom Apparel', margin, 15);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('(253) 922-5793 | sales@nwcustomapparel.com', margin, 22);

        // Quote ID
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Quote #${this.quoteId}`, pageWidth - margin, 15, { align: 'right' });

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const status = this.quoteData.Status || 'Open';
        pdf.text(status, pageWidth - margin, 22, { align: 'right' });

        yPos = 45;

        // Reset text color
        pdf.setTextColor(51, 51, 51);

        // Customer Info
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PREPARED FOR', margin, yPos);
        yPos += 6;

        pdf.setFont('helvetica', 'normal');
        pdf.text(this.quoteData.CustomerName || 'N/A', margin, yPos);
        yPos += 5;
        if (this.quoteData.CompanyName) {
            pdf.text(this.quoteData.CompanyName, margin, yPos);
            yPos += 5;
        }
        if (this.quoteData.CustomerEmail) {
            pdf.text(this.quoteData.CustomerEmail, margin, yPos);
            yPos += 5;
        }

        // Quote Details (right side)
        const rightCol = pageWidth - margin - 50;
        pdf.setFont('helvetica', 'bold');
        pdf.text('QUOTE DETAILS', rightCol, 45);

        pdf.setFont('helvetica', 'normal');
        pdf.text(`Type: ${this.getQuoteType()}`, rightCol, 51);
        pdf.text(`Created: ${this.formatDate(this.quoteData.CreatedAt)}`, rightCol, 57);
        pdf.text(`Valid Until: ${this.formatDate(this.quoteData.ExpiresAt)}`, rightCol, 63);

        yPos = 80;

        // Divider
        pdf.setDrawColor(76, 179, 84);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

        // Items
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Products', margin, yPos);
        yPos += 8;

        // Items table
        this.items.forEach(item => {
            if (yPos > 250) {
                pdf.addPage();
                yPos = 20;
            }

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${item.StyleNumber} - ${item.Color}`, margin, yPos);
            yPos += 5;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            const sizeInfo = this.parseSizeBreakdown(item.SizeBreakdown);
            const sizeStr = Object.entries(sizeInfo)
                .filter(([_, qty]) => qty > 0)
                .map(([size, qty]) => `${size}(${qty})`)
                .join(' ') || `Qty: ${item.Quantity}`;
            pdf.text(sizeStr, margin + 5, yPos);

            const unitPrice = item.FinalUnitPrice || item.BaseUnitPrice || 0;
            const lineTotal = item.LineTotal || (unitPrice * item.Quantity);
            pdf.text(`${this.formatCurrency(unitPrice)} x ${item.Quantity} = ${this.formatCurrency(lineTotal)}`, pageWidth - margin - 60, yPos);
            yPos += 8;
        });

        // Totals
        yPos += 5;
        pdf.setDrawColor(76, 179, 84);
        pdf.line(margin + 100, yPos, pageWidth - margin, yPos);
        yPos += 8;

        const subtotal = parseFloat(this.quoteData.SubtotalAmount) || 0;
        const ltmFee = parseFloat(this.quoteData.LTMFeeTotal) || 0;
        const grandTotal = parseFloat(this.quoteData.TotalAmount) || 0;
        const taxAmount = grandTotal * this.taxRate;
        const totalWithTax = grandTotal + taxAmount;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Subtotal:', margin + 120, yPos);
        pdf.text(this.formatCurrency(subtotal), margin + 155, yPos);
        yPos += 6;

        if (ltmFee > 0) {
            pdf.text('LTM Fee:', margin + 120, yPos);
            pdf.text(this.formatCurrency(ltmFee), margin + 155, yPos);
            yPos += 6;
        }

        pdf.text('WA Sales Tax (10.1%):', margin + 100, yPos);
        pdf.text(this.formatCurrency(taxAmount), margin + 155, yPos);
        yPos += 8;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('TOTAL:', margin + 120, yPos);
        pdf.setTextColor(76, 179, 84);
        pdf.text(this.formatCurrency(totalWithTax), margin + 155, yPos);

        // Footer
        const footerY = 265;
        pdf.setFontSize(8);
        pdf.setTextColor(102, 102, 102);
        pdf.setFont('helvetica', 'normal');
        pdf.text('This quote is valid for 30 days. 50% deposit required to begin production.', margin, footerY);
        pdf.text('Thank you for your business!', margin, footerY + 4);

        pdf.setTextColor(76, 179, 84);
        pdf.text(`Northwest Custom Apparel | (253) 922-5793 | nwcustomapparel.com`, pageWidth / 2, footerY + 10, { align: 'center' });
    }

    // Helper Methods
    getQuoteType() {
        if (!this.quoteId) return 'Custom Quote';
        const prefix = this.quoteId.split(/[\d-]/)[0];
        return this.quoteTypes[prefix] || 'Custom Quote';
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    formatPhone(phone) {
        if (!phone) return '';
        const cleaned = String(phone).replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.substr(0, 3)}) ${cleaned.substr(3, 3)}-${cleaned.substr(6)}`;
        }
        return phone;
    }

    parseSizeBreakdown(breakdown) {
        if (!breakdown) return {};

        try {
            const sizes = typeof breakdown === 'string' ? JSON.parse(breakdown) : breakdown;
            if (typeof sizes === 'object') {
                return sizes;
            }
        } catch (e) {
            // Try to parse string format like "S:6, M:3"
            const result = {};
            if (typeof breakdown === 'string' && breakdown.includes(':')) {
                breakdown.split(',').forEach(part => {
                    const [size, qty] = part.trim().split(':');
                    if (size && qty) {
                        result[size.trim()] = parseInt(qty.trim()) || 0;
                    }
                });
                return result;
            }
        }

        return {};
    }

    isExpired() {
        if (!this.quoteData.ExpiresAt) return false;
        const expiresAt = new Date(this.quoteData.ExpiresAt);
        return expiresAt < new Date();
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // UI State Methods
    showContent() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('quote-content').style.display = 'block';
    }

    showError(message) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-state').style.display = 'flex';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new QuoteViewPage();
});
