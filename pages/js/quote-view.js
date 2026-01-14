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

            // Debug charge verification (2026-01-14)
            this.debugChargeVerification();

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
        document.getElementById('created-date').textContent = this.formatDate(this.quoteData.CreatedAt_Quote);
        document.getElementById('expires-date').textContent = this.formatDate(this.quoteData.ExpiresAt);

        // Sales Rep (if available)
        const salesRep = this.quoteData.SalesRepName || this.quoteData.SalesRep || '';
        if (salesRep) {
            document.getElementById('sales-rep').textContent = salesRep;
            document.getElementById('sales-rep-row').style.display = 'flex';
        }

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

            const data = await response.json();
            // API returns object with numeric keys - convert to array
            const colors = Array.isArray(data) ? data : Object.values(data);
            if (colors.length === 0) {
                console.warn(`[QuoteView] No color data returned for ${styleNumber}`);
                return '';
            }

            // Normalize function for color matching
            const normalizeColor = (str) => (str || '').toLowerCase()
                .replace(/\s+/g, '')     // Remove spaces
                .replace(/[\/\-]/g, ''); // Remove slashes and dashes

            // Normalized search color
            const colorNorm = normalizeColor(colorName);

            // First try: Exact match on normalized COLOR_NAME
            let match = colors.find(c => normalizeColor(c.COLOR_NAME) === colorNorm);

            // Second try: Exact match on normalized CATALOG_COLOR
            if (!match) {
                match = colors.find(c => normalizeColor(c.CATALOG_COLOR) === colorNorm);
            }

            // Third try: Partial match (substring in either direction)
            if (!match) {
                match = colors.find(c => {
                    const name = normalizeColor(c.COLOR_NAME);
                    const catalog = normalizeColor(c.CATALOG_COLOR);
                    return name.includes(colorNorm) || colorNorm.includes(name) ||
                           catalog.includes(colorNorm) || colorNorm.includes(catalog);
                });
            }

            // Fourth try: Word-based match (for multi-word colors like "Atlantic Blue Chrome")
            if (!match) {
                const searchWords = colorNorm.match(/[a-z]+/g) || [];
                if (searchWords.length >= 2) {
                    match = colors.find(c => {
                        const name = normalizeColor(c.COLOR_NAME);
                        // Check if at least 2 words match
                        return searchWords.filter(w => name.includes(w)).length >= 2;
                    });
                }
            }

            // Return best image (prefer FRONT_MODEL, fallback to first color)
            const imageUrl = match?.FRONT_MODEL || match?.FRONT_FLAT ||
                           colors[0]?.FRONT_MODEL || colors[0]?.FRONT_FLAT || '';

            // Cache the result
            this.imageCache[cacheKey] = imageUrl;

            console.log(`[QuoteView] Fetched image for ${styleNumber} ${colorName}: ${imageUrl ? 'Found' : 'Not found'}${match ? ` (matched: ${match.COLOR_NAME})` : ''}`);
            return imageUrl;

        } catch (error) {
            console.error(`[QuoteView] Error fetching product image for ${styleNumber}:`, error);
            return '';
        }
    }

    /**
     * Render items as a compact table
     * Columns: Style | Color | S | M | LG | XL | XXL | XXXL | Qty | Unit $ | Total
     * Description removed - shown in product detail modal instead
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

        // Store groups for modal access
        this.productGroups = groups;

        // Build embroidery info section
        let html = this.renderEmbroideryInfo();

        // Build compact table HTML (no Description column)
        html += `
            <div class="product-table-wrapper">
                <table class="product-table compact">
                    <thead>
                        <tr>
                            <th class="style-col">Style</th>
                            <th class="color-col">Color</th>
                            <th class="size-col">S</th>
                            <th class="size-col">M</th>
                            <th class="size-col">LG</th>
                            <th class="size-col">XL</th>
                            <th class="size-col">XXL</th>
                            <th class="size-col">XXXL</th>
                            <th class="qty-col">Qty</th>
                            <th class="price-col">Unit $</th>
                            <th class="total-col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Render rows for each product group
        let rowIndex = 0;
        groups.forEach((group, groupIndex) => {
            const rows = this.buildProductRows(group, groupIndex);
            rows.forEach((row, i) => {
                html += this.renderProductRow(row, i === 0, groupIndex);
                rowIndex++;
            });
        });

        // Render fee line items (Additional Stitches, AL charges, Digitizing)
        html += this.renderFeeRows();

        html += `
                    </tbody>
                </table>
            </div>
        `;

        // Add product detail modal container
        html += `
            <div id="product-modal" class="product-modal hidden">
                <div class="product-modal-backdrop" onclick="window.quoteViewPage.closeProductModal()"></div>
                <div class="product-modal-content">
                    <button class="product-modal-close" onclick="window.quoteViewPage.closeProductModal()">&times;</button>
                    <div class="product-modal-body">
                        <img id="modal-product-image" class="product-modal-image" src="" alt="">
                        <div class="product-modal-details">
                            <h3 id="modal-product-name"></h3>
                            <p class="modal-style">Style: <span id="modal-style-number"></span></p>
                            <p class="modal-color">Color: <span id="modal-color-name"></span></p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Store reference for modal access
        window.quoteViewPage = this;

        // Fetch and update images for each product (async)
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const imageUrl = await this.fetchProductImage(group.styleNumber, group.color);

            // Store image URL for modal
            group.imageUrl = imageUrl;

            if (imageUrl) {
                const imgElement = container.querySelector(`#product-image-${i}`);
                if (imgElement) {
                    imgElement.src = imageUrl;
                    imgElement.onload = function() {
                        this.style.opacity = '1';
                    };
                    imgElement.onerror = function() {
                        this.style.display = 'none';
                    };
                }
            }
        }
    }

    /**
     * Render embroidery info section (location, stitches, additionals)
     */
    renderEmbroideryInfo() {
        // Get embroidery details from quote data
        const location = this.quoteData?.PrintLocation || this.quoteData?.LogoLocation || 'Left Chest';
        const stitches = this.quoteData?.StitchCount || this.quoteData?.Stitches || '8000';
        const digitizing = this.quoteData?.DigitizingFee || 0;
        const addlLocation = this.quoteData?.AdditionalLogoLocation || '';
        const addlStitches = parseInt(this.quoteData?.AdditionalStitchCount) || 0;

        let html = `<div class="embroidery-info">`;
        html += `<div class="emb-detail"><span class="emb-label">Location:</span> <span class="emb-value">${this.escapeHtml(location)}</span></div>`;
        html += `<div class="emb-detail"><span class="emb-label">Stitches:</span> <span class="emb-value">${this.escapeHtml(String(stitches))}</span></div>`;
        if (digitizing > 0) {
            html += `<div class="emb-detail"><span class="emb-label">Digitizing:</span> <span class="emb-value">${this.formatCurrency(digitizing)}</span></div>`;
        }
        // Additional Stitch Charge (extra stitches above 8k base)
        const additionalStitchCharge = parseFloat(this.quoteData?.AdditionalStitchCharge) || 0;
        if (additionalStitchCharge > 0) {
            html += `<div class="emb-detail"><span class="emb-label">Additional Stitches:</span> <span class="emb-value">${this.formatCurrency(additionalStitchCharge)}</span></div>`;
        }
        // Additional Logo info (if present)
        if (addlLocation || addlStitches > 0) {
            const addlText = addlLocation
                ? `${this.escapeHtml(addlLocation)} (${addlStitches.toLocaleString()} stitches)`
                : `${addlStitches.toLocaleString()} stitches`;
            html += `<div class="emb-detail"><span class="emb-label">Additional Logo:</span> <span class="emb-value">${addlText}</span></div>`;
        }
        // Cap embroidery info (if present)
        const capLocation = this.quoteData?.CapPrintLocation || '';
        const capStitches = parseInt(this.quoteData?.CapStitchCount) || 0;
        const capDigitizing = this.quoteData?.CapDigitizingFee || 0;
        if (capLocation || capStitches > 0) {
            const capText = capLocation
                ? `${this.escapeHtml(capLocation)} (${capStitches.toLocaleString()} stitches)`
                : `${capStitches.toLocaleString()} stitches`;
            html += `<div class="emb-detail"><span class="emb-label">Cap Location:</span> <span class="emb-value">${capText}</span></div>`;
            if (capDigitizing > 0) {
                html += `<div class="emb-detail"><span class="emb-label">Cap Digitizing:</span> <span class="emb-value">${this.formatCurrency(capDigitizing)}</span></div>`;
            }
        }
        html += `</div>`;
        return html;
    }

    /**
     * Render fee charges as line items in the product table
     * Part # | Description | S | M | LG | XL | XXL | XXXL | Qty | Unit $ | Total
     * Quantity goes in XXXL column (Size06 catch-all per ShopWorks)
     */
    renderFeeRows() {
        let html = '';

        // NOTE: ADDL-STITCH row removed (2026-01-14)
        // Extra stitch charges are already baked into product unit prices (see embroidery-quote-pricing.js line 662)
        // Showing them as a separate fee row confused customers into thinking they were double-charged
        // The extra stitch info is still shown in the embroidery details section for transparency

        // 1. AL Garment Charge (Additional Logo on garments)
        const alGarmentCharge = parseFloat(this.quoteData?.ALChargeGarment) || 0;
        const garmentQty = parseInt(this.quoteData?.ALGarmentQty) || 0;
        if (alGarmentCharge > 0 && garmentQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALGarmentUnitPrice) || (alGarmentCharge / garmentQty);
            const desc = this.quoteData?.ALGarmentDesc || 'AL: Additional Logo';
            html += this.renderFeeRow('AL-GARMENT', desc, garmentQty, unitPrice, alGarmentCharge);
        }

        // 3. AL Cap Charge (Additional Logo on caps)
        const alCapCharge = parseFloat(this.quoteData?.ALChargeCap) || 0;
        const capQty = parseInt(this.quoteData?.ALCapQty) || 0;
        if (alCapCharge > 0 && capQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALCapUnitPrice) || (alCapCharge / capQty);
            const desc = this.quoteData?.ALCapDesc || 'AL: Cap Logo';
            html += this.renderFeeRow('AL-CAP', desc, capQty, unitPrice, alCapCharge);
        }

        // 4. Garment Digitizing (flat fee per logo needing digitizing)
        const garmentDigitizing = parseFloat(this.quoteData?.GarmentDigitizing) || 0;
        if (garmentDigitizing > 0) {
            html += this.renderFeeRow('DIGITIZE-G', 'Garment Digitizing', 1, garmentDigitizing, garmentDigitizing);
        }

        // 5. Cap Digitizing (flat fee per cap logo needing digitizing)
        const capDigitizing = parseFloat(this.quoteData?.CapDigitizing) || 0;
        if (capDigitizing > 0) {
            html += this.renderFeeRow('DIGITIZE-C', 'Cap Digitizing', 1, capDigitizing, capDigitizing);
        }

        // 6. Artwork Charge (redraw fee)
        const artCharge = parseFloat(this.quoteData?.ArtCharge) || 0;
        if (artCharge > 0) {
            html += this.renderFeeRow('ARTWORK', 'Art Charge / Redraw', 1, artCharge, artCharge);
        }

        // 7. Rush Fee (expedited processing)
        const rushFee = parseFloat(this.quoteData?.RushFee) || 0;
        if (rushFee > 0) {
            html += this.renderFeeRow('RUSH', 'Rush Fee', 1, rushFee, rushFee);
        }

        // 8. Sample Fee
        const sampleFee = parseFloat(this.quoteData?.SampleFee) || 0;
        const sampleQty = parseInt(this.quoteData?.SampleQty) || 1;
        if (sampleFee > 0) {
            const sampleUnitPrice = sampleQty > 0 ? sampleFee / sampleQty : sampleFee;
            html += this.renderFeeRow('SAMPLE', 'Sample Fee', sampleQty, sampleUnitPrice, sampleFee);
        }

        // 9. LTM Fee - Garments (Less Than Minimum for garments)
        const ltmGarment = parseFloat(this.quoteData?.LTM_Garment) || 0;
        const garmentQtyLTM = parseInt(this.quoteData?.ALGarmentQty) || parseInt(this.quoteData?.TotalQuantity) || 0;
        if (ltmGarment > 0 && garmentQtyLTM > 0) {
            const ltmGarmentUnit = ltmGarment / garmentQtyLTM;
            html += this.renderFeeRow('LTM-G', 'LTM Fee: Garments', garmentQtyLTM, ltmGarmentUnit, ltmGarment);
        }

        // 10. LTM Fee - Caps (Less Than Minimum for caps)
        const ltmCap = parseFloat(this.quoteData?.LTM_Cap) || 0;
        const capQtyLTM = parseInt(this.quoteData?.ALCapQty) || 0;
        if (ltmCap > 0 && capQtyLTM > 0) {
            const ltmCapUnit = ltmCap / capQtyLTM;
            html += this.renderFeeRow('LTM-C', 'LTM Fee: Caps', capQtyLTM, ltmCapUnit, ltmCap);
        }

        // 11. Discount (negative line item)
        const discount = parseFloat(this.quoteData?.Discount) || 0;
        const discountReason = this.quoteData?.DiscountReason || '';
        const discountPercent = parseFloat(this.quoteData?.DiscountPercent) || 0;
        if (discount > 0) {
            const discountDesc = discountPercent > 0
                ? `Discount (${discountPercent}%)${discountReason ? ': ' + discountReason : ''}`
                : `Discount${discountReason ? ': ' + discountReason : ''}`;
            // Discount shows as negative
            html += this.renderFeeRow('DISCOUNT', discountDesc, 1, -discount, -discount, true);
        }

        return html;
    }

    /**
     * Render a single fee row
     * Quantity goes in XXXL column (Size06 catch-all per ShopWorks standard)
     * @param {boolean} isDiscount - If true, row styled as discount (red/negative)
     */
    renderFeeRow(partNum, description, qty, unitPrice, total, isDiscount = false) {
        const rowClass = isDiscount ? 'fee-row discount-row' : 'fee-row';
        return `
            <tr class="${rowClass}">
                <td class="style-col fee-part">${this.escapeHtml(partNum)}</td>
                <td class="color-col fee-desc">${this.escapeHtml(description)}</td>
                <td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col">${qty}</td>
                <td class="qty-col">${qty}</td>
                <td class="price-col">${this.formatCurrency(unitPrice)}</td>
                <td class="total-col">${this.formatCurrency(total)}</td>
            </tr>
        `;
    }

    /**
     * Open product detail modal
     */
    openProductModal(groupIndex) {
        const group = this.productGroups[groupIndex];
        if (!group) return;

        const modal = document.getElementById('product-modal');
        const modalImage = document.getElementById('modal-product-image');
        const modalName = document.getElementById('modal-product-name');
        const modalStyle = document.getElementById('modal-style-number');
        const modalColor = document.getElementById('modal-color-name');

        modalImage.src = group.imageUrl || '/pages/images/product-placeholder.png';
        modalName.textContent = group.productName || 'Product';
        modalStyle.textContent = group.styleNumber;
        modalColor.textContent = group.color;

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close product detail modal
     */
    closeProductModal() {
        const modal = document.getElementById('product-modal');
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /**
     * Build row data for a product group
     * Returns array of rows: standard sizes row + individual extended size rows
     */
    buildProductRows(productGroup, groupIndex) {
        const rows = [];

        // Parse all items to understand what sizes we have
        const allSizes = {};
        productGroup.items.forEach(item => {
            const breakdown = this.parseSizeBreakdown(item.SizeBreakdown);
            Object.entries(breakdown).forEach(([size, qty]) => {
                if (qty > 0) {
                    if (!allSizes[size]) {
                        allSizes[size] = { qty: 0, price: 0, total: 0 };
                    }
                    allSizes[size].qty += qty;
                    allSizes[size].price = item.FinalUnitPrice || 0;
                    allSizes[size].total += (qty * (item.FinalUnitPrice || 0));
                }
            });
        });

        // Standard sizes (S, M, L, XL) - one row
        const standardSizes = ['S', 'M', 'L', 'XL'];
        const stdSizeData = {};
        let stdQty = 0;
        let stdPrice = 0;
        let stdTotal = 0;

        standardSizes.forEach(size => {
            if (allSizes[size]) {
                stdSizeData[size] = allSizes[size].qty;
                stdQty += allSizes[size].qty;
                stdPrice = allSizes[size].price; // All standard sizes same price
                stdTotal += allSizes[size].total;
            }
        });

        if (stdQty > 0) {
            rows.push({
                style: productGroup.styleNumber,
                description: productGroup.productName,
                color: productGroup.color,
                sizes: stdSizeData,
                qty: stdQty,
                unitPrice: stdPrice,
                lineTotal: stdTotal,
                isFirstRow: true,
                groupIndex: groupIndex
            });
        }

        // Extended sizes - each gets its own row
        // Size05: 2XL only
        // Size06: Everything else (3XL+, OSFA, combo sizes) - the catch-all column
        const extendedSizes = ['2XL', '3XL', '4XL', '5XL', '6XL', 'OSFA', 'S/M', 'M/L', 'L/XL', 'ONE SIZE', 'ADJ'];
        extendedSizes.forEach(size => {
            if (allSizes[size] && allSizes[size].qty > 0) {
                const sizeData = {};
                sizeData[size] = allSizes[size].qty;

                // Determine style suffix based on size type
                let suffix;
                if (size === '2XL') {
                    suffix = '_2X';
                } else if (['OSFA', 'S/M', 'M/L', 'L/XL', 'ONE SIZE', 'ADJ'].includes(size)) {
                    suffix = `_${size.replace('/', '-')}`;  // OSFA → _OSFA, S/M → _S-M
                } else {
                    suffix = `_${size.replace('XL', 'X')}`;  // 3XL → _3X
                }

                rows.push({
                    style: `${productGroup.styleNumber}${suffix}`,
                    description: `${productGroup.productName} - ${size}`,
                    color: productGroup.color,
                    sizes: sizeData,
                    qty: allSizes[size].qty,
                    unitPrice: allSizes[size].price,
                    lineTotal: allSizes[size].total,
                    isFirstRow: false,
                    groupIndex: groupIndex
                });
            }
        });

        return rows;
    }

    /**
     * Render a single product row (compact - no Description column)
     */
    renderProductRow(row, isFirstRow, groupIndex) {
        // Map sizes to columns: S, M, LG(L), XL, XXL(2XL), XXXL(3XL+)
        const sCol = row.sizes['S'] || '';
        const mCol = row.sizes['M'] || '';
        const lgCol = row.sizes['L'] || '';
        const xlCol = row.sizes['XL'] || '';
        const xxlCol = row.sizes['2XL'] || '';
        // XXXL column is the catch-all (Size06): 3XL+, OSFA, combo sizes
        const xxxlCol = row.sizes['3XL'] || row.sizes['4XL'] || row.sizes['5XL'] || row.sizes['6XL']
                     || row.sizes['OSFA'] || row.sizes['S/M'] || row.sizes['M/L'] || row.sizes['L/XL']
                     || row.sizes['ONE SIZE'] || row.sizes['ADJ'] || '';

        // Style column with clickable image for first row (opens modal)
        let styleCell;
        if (isFirstRow) {
            styleCell = `
                <td class="style-col clickable" onclick="window.quoteViewPage.openProductModal(${groupIndex})">
                    <div class="style-with-image">
                        <img id="product-image-${groupIndex}" class="product-thumb" src="/pages/images/product-placeholder.png" alt="${this.escapeHtml(row.style)}">
                        <span>${this.escapeHtml(row.style)}</span>
                    </div>
                </td>
            `;
        } else {
            styleCell = `<td class="style-col ext-style">${this.escapeHtml(row.style)}</td>`;
        }

        return `
            <tr class="${isFirstRow ? 'first-row' : 'extended-row'}">
                ${styleCell}
                <td class="color-col">${this.escapeHtml(row.color)}</td>
                <td class="size-col">${sCol}</td>
                <td class="size-col">${mCol}</td>
                <td class="size-col">${lgCol}</td>
                <td class="size-col">${xlCol}</td>
                <td class="size-col">${xxlCol}</td>
                <td class="size-col">${xxxlCol}</td>
                <td class="qty-col">${row.qty}</td>
                <td class="price-col">${this.formatCurrency(row.unitPrice)}</td>
                <td class="total-col">${this.formatCurrency(row.lineTotal)}</td>
            </tr>
        `;
    }

    /**
     * Group items by product (StyleNumber + Color)
     * Normalizes color names to prevent duplicates from Color vs ColorCode inconsistencies
     * Dedupes items with same SizeBreakdown (keeps highest LineNumber - most recent)
     */
    groupItemsByProduct() {
        const groups = {};

        this.items.forEach(item => {
            // Get display color (prefer Color, fall back to ColorCode)
            const displayColor = item.Color || item.ColorCode || 'Unknown';

            // Normalize color for grouping key to prevent duplicates
            // "Atlantic Blue/ Chrome" and "AtlBlChrome" should group together
            const normalizedColor = displayColor.toLowerCase()
                .replace(/\s+/g, '')   // Remove all spaces
                .replace(/[\/\-]/g, ''); // Remove slashes and dashes

            const key = `${item.StyleNumber}-${normalizedColor}`;

            if (!groups[key]) {
                groups[key] = {
                    styleNumber: item.StyleNumber,
                    productName: this.extractProductName(item.ProductName),
                    color: item.Color || item.ColorCode || 'N/A', // Keep original for display
                    colorCode: item.ColorCode || item.Color || '', // For image URL construction
                    imageUrl: item.ImageURL,
                    printLocation: item.PrintLocationName || item.PrintLocation,
                    embellishmentType: item.EmbellishmentType,
                    items: []
                };
            }
            groups[key].items.push(item);
        });

        // Dedupe items within each group - keep only unique SizeBreakdowns
        // If duplicates exist (from multiple pricing tiers), keep the one with highest LineNumber
        Object.values(groups).forEach(group => {
            const seen = new Map(); // Map<SizeBreakdown, item>

            group.items.forEach(item => {
                const sizeKey = item.SizeBreakdown || '';
                const existingItem = seen.get(sizeKey);

                // Keep item with higher LineNumber (more recent)
                if (!existingItem || (item.LineNumber || 0) > (existingItem.LineNumber || 0)) {
                    seen.set(sizeKey, item);
                }
            });

            // Replace items with deduped list
            const dedupedItems = Array.from(seen.values());
            if (dedupedItems.length < group.items.length) {
                console.log(`[QuoteView] Deduped ${group.styleNumber} ${group.color}: ${group.items.length} → ${dedupedItems.length} items`);
                group.items = dedupedItems;
            }
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
                             onload="this.nextElementSibling.style.display='none';"
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
     * Handles three formats:
     * 1. OLD FORMAT: Multiple items with IDENTICAL SizeBreakdowns (pre-fix data) - aggregate and split by tier
     * 2. NEW FORMAT: Multiple items with UNIQUE SizeBreakdowns - render each directly
     * 3. LEGACY FORMAT: Single item with all sizes - split by price tier
     */
    renderSizeMatrix(productGroup) {
        const rows = [];

        // Check if items have valid stored prices
        const hasValidStoredPrices = productGroup.items.some(item =>
            item.FinalUnitPrice && item.FinalUnitPrice > 10 && item.LineTotal > 0
        );

        // Check if all items have IDENTICAL SizeBreakdowns (OLD format indicator)
        // This happens when quotes were saved before the fix that parses per-lineItem sizes
        const sizeBreakdowns = productGroup.items.map(item => {
            const sb = this.parseSizeBreakdown(item.SizeBreakdown);
            // Sort keys for consistent comparison
            return JSON.stringify(sb, Object.keys(sb).sort());
        });
        const hasDuplicateSizeBreakdowns = productGroup.items.length > 1 &&
            sizeBreakdowns.every(sb => sb === sizeBreakdowns[0]) &&
            sizeBreakdowns[0] !== '{}';

        if (hasDuplicateSizeBreakdowns) {
            // OLD FORMAT: All items have same SizeBreakdown - aggregate and split by price tier
            // This fixes quotes where every row incorrectly shows ALL sizes
            console.log('[QuoteView] Detected OLD format with duplicate SizeBreakdowns - using aggregated approach');

            const aggregatedBreakdown = this.parseSizeBreakdown(productGroup.items[0].SizeBreakdown);
            const totalLineTotal = productGroup.items.reduce((sum, item) =>
                sum + (parseFloat(item.LineTotal) || 0), 0);
            const totalQty = productGroup.items.reduce((sum, item) =>
                sum + (parseInt(item.Quantity) || 0), 0);

            // Calculate base price from aggregated data
            // Use average price if valid, otherwise fallback to getUnitPriceForSize
            const avgPrice = totalQty > 0 ? totalLineTotal / totalQty : 0;
            const basePrice = avgPrice > 10 ? avgPrice : this.getUnitPriceForSize('S');

            // Split into standard and extended sizes
            const standardSizesData = {};
            const extendedSizesData = {};

            Object.entries(aggregatedBreakdown).forEach(([size, qty]) => {
                if (qty > 0) {
                    if (this.extendedSizes.includes(size)) {
                        extendedSizesData[size] = qty;
                    } else {
                        standardSizesData[size] = qty;
                    }
                }
            });

            // Standard sizes row (all at base price)
            if (Object.keys(standardSizesData).length > 0) {
                const stdQty = Object.values(standardSizesData).reduce((a, b) => a + b, 0);
                const stdLabel = Object.entries(standardSizesData)
                    .sort((a, b) => this.sizeOrder.indexOf(a[0]) - this.sizeOrder.indexOf(b[0]))
                    .map(([s, q]) => `${s}(${q})`).join(' ');
                rows.push({
                    label: stdLabel,
                    qty: stdQty,
                    unitPrice: basePrice,
                    total: stdQty * basePrice,
                    isExtended: false
                });
            }

            // Extended sizes - each separately with upcharge
            Object.entries(extendedSizesData)
                .sort((a, b) => this.sizeOrder.indexOf(a[0]) - this.sizeOrder.indexOf(b[0]))
                .forEach(([size, qty]) => {
                    const upcharge = this.sizeUpcharges[size] || 0;
                    const extPrice = basePrice + upcharge;
                    rows.push({
                        label: `${size}(${qty})`,
                        qty: qty,
                        unitPrice: extPrice,
                        total: qty * extPrice,
                        isExtended: true
                    });
                });

        } else if (hasValidStoredPrices || productGroup.items.length > 1) {
            // NEW FORMAT: Multiple items with unique SizeBreakdowns - render each item directly
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

        // Show subtotal INCLUDING LTM (since LTM is now shown as line items LTM-G/LTM-C)
        // This makes the math cleaner: Subtotal → Tax → Total
        const subtotalWithLtm = subtotal + ltmFee;
        totalsHtml += `
            <div class="total-row">
                <span class="label">Subtotal:</span>
                <span class="value">${this.formatCurrency(subtotalWithLtm)}</span>
            </div>
        `;

        // LTM no longer shown here - it's now a line item (LTM-G, LTM-C) in the product table

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

        // Header - green banner with company info
        pdf.setFillColor(76, 179, 84); // #4cb354
        pdf.rect(0, 0, pageWidth, 42, 'F');

        // Company name and address
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Northwest Custom Apparel', margin, 12);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('2025 Freeman Road East, Milton, WA 98354', margin, 19);
        pdf.text('(253) 922-5793 | sales@nwcustomapparel.com', margin, 25);
        pdf.text('www.nwcustomapparel.com', margin, 31);

        // Quote ID (right side)
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Quote #${this.quoteId}`, pageWidth - margin, 14, { align: 'right' });

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const status = this.quoteData.Status || 'Open';
        pdf.text(status, pageWidth - margin, 22, { align: 'right' });

        yPos = 50;

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
        pdf.text('QUOTE DETAILS', rightCol, 50);

        pdf.setFont('helvetica', 'normal');
        pdf.text(`Type: ${this.getQuoteType()}`, rightCol, 56);
        pdf.text(`Created: ${this.formatDate(this.quoteData.CreatedAt_Quote)}`, rightCol, 62);
        pdf.text(`Valid Until: ${this.formatDate(this.quoteData.ExpiresAt)}`, rightCol, 68);

        // Add Sales Rep if available
        const salesRep = this.quoteData.SalesRepName || this.quoteData.SalesRep || '';
        if (salesRep) {
            pdf.text(`Sales Rep: ${salesRep}`, rightCol, 74);
        }

        yPos = Math.max(yPos, 80);

        // Divider
        pdf.setDrawColor(76, 179, 84);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;

        // Embroidery Details Section (for embroidery quotes)
        const quoteType = this.getQuoteType();
        if (quoteType === 'Embroidery' || quoteType === 'Customer Supplied Embroidery') {
            // Get embroidery details from quote data
            const location = this.quoteData?.PrintLocation || this.quoteData?.LogoLocation || 'Left Chest';
            const stitches = this.quoteData?.StitchCount || this.quoteData?.Stitches || '8000';
            const digitizing = parseFloat(this.quoteData?.DigitizingFee) || 0;
            const additionalStitchCharge = parseFloat(this.quoteData?.AdditionalStitchCharge) || 0;
            const addlLocation = this.quoteData?.AdditionalLogoLocation || '';
            const addlStitches = parseInt(this.quoteData?.AdditionalStitchCount) || 0;
            // Cap embroidery details
            const capLocation = this.quoteData?.CapPrintLocation || '';
            const capStitches = parseInt(this.quoteData?.CapStitchCount) || 0;
            const capDigitizing = parseFloat(this.quoteData?.CapDigitizingFee) || 0;

            // Calculate box height: base 22mm, add 6mm for each extra row
            const hasAddlLogo = addlLocation || addlStitches > 0;
            const hasCapLogo = capLocation || capStitches > 0;
            let boxHeight = 22;
            if (hasAddlLogo) boxHeight += 6;
            if (hasCapLogo) boxHeight += 6;

            pdf.setFillColor(248, 250, 252); // Light blue-gray background
            pdf.rect(margin, yPos - 2, pageWidth - margin * 2, boxHeight, 'F');

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(51, 51, 51);
            pdf.text('EMBROIDERY DETAILS', margin + 3, yPos + 4);

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');

            // Row 1: Location and Stitch Count
            pdf.text(`Location: ${location}`, margin + 3, yPos + 11);
            pdf.text(`Stitch Count: ${stitches.toLocaleString()}`, margin + 70, yPos + 11);

            // Row 2: Digitizing and Additional Charges
            if (digitizing > 0) {
                pdf.text(`Digitizing Fee: ${this.formatCurrency(digitizing)}`, margin + 3, yPos + 17);
            }
            if (additionalStitchCharge > 0) {
                pdf.text(`Add'l Stitch Charge: ${this.formatCurrency(additionalStitchCharge)}`, margin + 70, yPos + 17);
            }

            // Row 3: Additional Logo (if present)
            if (hasAddlLogo) {
                const addlText = addlLocation
                    ? `Additional Logo: ${addlLocation} (${addlStitches.toLocaleString()} stitches)`
                    : `Additional Logo: ${addlStitches.toLocaleString()} stitches`;
                pdf.text(addlText, margin + 3, yPos + 23);
            }

            // Row 4: Cap Logo (if present)
            if (hasCapLogo) {
                const capRowY = hasAddlLogo ? 29 : 23;
                let capText = capLocation
                    ? `Cap Logo: ${capLocation} (${capStitches.toLocaleString()} stitches)`
                    : `Cap Logo: ${capStitches.toLocaleString()} stitches`;
                if (capDigitizing > 0) {
                    capText += ` + ${this.formatCurrency(capDigitizing)} digitizing`;
                }
                pdf.text(capText, margin + 3, yPos + capRowY);
            }

            yPos += boxHeight + 4;
        }

        // Products Section
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(51, 51, 51);
        pdf.text('PRODUCTS', margin, yPos);
        yPos += 6;

        // Table header - with Style/Description column
        // Page: 215.9mm, margins: 20mm each, usable: 175.9mm
        // Updated 2026-01-13: Widened color column for multi-color combos like "White/Charcoal"
        const colX = {
            styleDesc: margin,       // 20mm  - Style/Description (wider)
            color: margin + 58,      // 78mm  - Color column (widened +3mm)
            s: margin + 86,          // 106mm - Size columns (compressed slightly)
            m: margin + 93,          // 113mm
            lg: margin + 100,        // 120mm
            xl: margin + 107,        // 127mm
            xxl: margin + 114,       // 134mm
            xxxl: margin + 123,      // 143mm
            qty: margin + 132,       // 152mm - Qty column
            price: margin + 144,     // 164mm - Unit $ column
            total: margin + 160      // 180mm - Total column
        };

        // Light gray header - prints well in B&W
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPos - 4, pageWidth - margin * 2, 7, 'F');

        // Dark text on light background
        pdf.setTextColor(51, 51, 51);
        pdf.setFontSize(6.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Item / Description', colX.styleDesc + 2, yPos);
        pdf.text('Color', colX.color + 2, yPos);
        pdf.text('S', colX.s + 2, yPos);
        pdf.text('M', colX.m + 2, yPos);
        pdf.text('L', colX.lg + 2, yPos);
        pdf.text('XL', colX.xl + 1, yPos);
        pdf.text('2X', colX.xxl + 1, yPos);
        pdf.text('3X+', colX.xxxl, yPos);
        pdf.text('Qty', colX.qty + 1, yPos);
        pdf.text('Unit $', colX.price - 1, yPos);
        pdf.text('Total', colX.total, yPos);

        // Bottom border for separation
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos + 3, pageWidth - margin, yPos + 3);
        yPos += 7;

        pdf.setTextColor(51, 51, 51);

        // Use same grouping/deduplication as web view
        const productGroups = this.groupItemsByProduct();
        const groups = Object.values(productGroups);

        groups.forEach(group => {
            const rows = this.buildProductRows(group, 0);
            rows.forEach((row, i) => {
                if (yPos > 250) {
                    pdf.addPage();
                    yPos = 20;
                }

                // Map sizes to columns
                const sCol = row.sizes['S'] || '';
                const mCol = row.sizes['M'] || '';
                const lgCol = row.sizes['L'] || '';
                const xlCol = row.sizes['XL'] || '';
                const xxlCol = row.sizes['2XL'] || '';
                // XXXL column is the catch-all (Size06): 3XL+, OSFA, combo sizes
                const xxxlCol = row.sizes['3XL'] || row.sizes['4XL'] || row.sizes['5XL'] || row.sizes['6XL']
                             || row.sizes['OSFA'] || row.sizes['S/M'] || row.sizes['M/L'] || row.sizes['L/XL']
                             || row.sizes['ONE SIZE'] || row.sizes['ADJ'] || '';

                // Truncate description to fit (increased from 18 to 22 chars for long names like "Richardson Trucker Cap")
                const truncDesc = (row.description || '').substring(0, 22);
                const styleDesc = `${row.style} - ${truncDesc}`;

                pdf.setFontSize(7);
                if (i === 0) {
                    pdf.setFont('helvetica', 'bold');
                } else {
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(180, 83, 9); // Orange for extended
                }

                // Combined style/description column (increased from 28 to 32 chars)
                pdf.text(styleDesc.substring(0, 32), colX.styleDesc + 2, yPos);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(51, 51, 51);
                // Color column (increased from 10 to 16 chars for combos like "White/Charcoal")
                pdf.text(row.color.substring(0, 16), colX.color + 2, yPos);

                // Size columns
                pdf.text(String(sCol), colX.s + 3, yPos);
                pdf.text(String(mCol), colX.m + 3, yPos);
                pdf.text(String(lgCol), colX.lg + 3, yPos);
                pdf.text(String(xlCol), colX.xl + 3, yPos);
                pdf.text(String(xxlCol), colX.xxl + 3, yPos);
                pdf.text(String(xxxlCol), colX.xxxl + 3, yPos);
                // Qty, Price, Total - properly spaced
                pdf.setFont('helvetica', 'bold');
                pdf.text(String(row.qty), colX.qty + 4, yPos);
                pdf.setFont('helvetica', 'normal');
                pdf.text(this.formatCurrency(row.unitPrice), colX.price, yPos);
                pdf.setTextColor(76, 179, 84);
                pdf.text(this.formatCurrency(row.lineTotal), colX.total, yPos);
                pdf.setTextColor(51, 51, 51);

                yPos += 6;
            });
        });

        // Fee line items (Additional Stitches, AL charges, Digitizing)
        yPos = this.renderPdfFeeRows(pdf, yPos, colX);

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
        // Subtotal includes LTM (since LTM is now a line item LTM-G/LTM-C in the table)
        const subtotalWithLtm = subtotal + ltmFee;
        pdf.text('Subtotal:', margin + 120, yPos);
        pdf.text(this.formatCurrency(subtotalWithLtm), margin + 155, yPos);
        yPos += 6;

        // LTM no longer shown here - it's a line item in the product table

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

    /**
     * Render fee line items in PDF (Additional Stitches, AL charges, Digitizing)
     * @returns {number} Updated yPos after rendering fee rows
     */
    renderPdfFeeRows(pdf, yPos, colX) {
        const pageWidth = 215.9;
        const margin = 10;

        // Check if any fees to render
        const addlStitchCharge = parseFloat(this.quoteData?.AdditionalStitchCharge) || 0;
        const totalQty = parseInt(this.quoteData?.TotalQuantity) || 0;
        const alGarmentCharge = parseFloat(this.quoteData?.ALChargeGarment) || 0;
        const garmentQty = parseInt(this.quoteData?.ALGarmentQty) || 0;
        const alCapCharge = parseFloat(this.quoteData?.ALChargeCap) || 0;
        const capQty = parseInt(this.quoteData?.ALCapQty) || 0;
        const garmentDigitizing = parseFloat(this.quoteData?.GarmentDigitizing) || 0;
        const capDigitizing = parseFloat(this.quoteData?.CapDigitizing) || 0;

        // Check all fee types
        const artChargePdf = parseFloat(this.quoteData?.ArtCharge) || 0;
        const rushFeePdf = parseFloat(this.quoteData?.RushFee) || 0;
        const sampleFeePdf = parseFloat(this.quoteData?.SampleFee) || 0;
        const ltmGarmentPdf = parseFloat(this.quoteData?.LTM_Garment) || 0;
        const ltmCapPdf = parseFloat(this.quoteData?.LTM_Cap) || 0;
        const discountPdf = parseFloat(this.quoteData?.Discount) || 0;

        // NOTE: addlStitchCharge removed from hasFees check (2026-01-14)
        // Extra stitch charges are baked into product unit prices, not a separate fee
        const hasFees = alGarmentCharge > 0 || alCapCharge > 0 ||
                        garmentDigitizing > 0 || capDigitizing > 0 ||
                        artChargePdf > 0 || rushFeePdf > 0 || sampleFeePdf > 0 ||
                        ltmGarmentPdf > 0 || ltmCapPdf > 0 || discountPdf > 0;
        if (!hasFees) return yPos;

        // Add separator line before fees
        yPos += 2;
        pdf.setDrawColor(76, 179, 84);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;

        pdf.setFontSize(7);

        // NOTE: ADDL-STITCH row removed (2026-01-14)
        // Extra stitch charges are already baked into product unit prices (see embroidery-quote-pricing.js line 662)
        // Showing them as a separate fee row confused customers into thinking they were double-charged

        // 1. AL Garment Charge
        if (alGarmentCharge > 0 && garmentQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALGarmentUnitPrice) || (alGarmentCharge / garmentQty);
            const desc = this.quoteData?.ALGarmentDesc || 'AL: Additional Logo';
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'AL-GARMENT', desc, garmentQty, unitPrice, alGarmentCharge);
        }

        // 3. AL Cap Charge
        if (alCapCharge > 0 && capQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALCapUnitPrice) || (alCapCharge / capQty);
            const desc = this.quoteData?.ALCapDesc || 'AL: Cap Logo';
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'AL-CAP', desc, capQty, unitPrice, alCapCharge);
        }

        // 4. Garment Digitizing
        if (garmentDigitizing > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'DIGITIZE-G', 'Garment Digitizing', 1, garmentDigitizing, garmentDigitizing);
        }

        // 5. Cap Digitizing
        if (capDigitizing > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'DIGITIZE-C', 'Cap Digitizing', 1, capDigitizing, capDigitizing);
        }

        // 6. Artwork Charge
        const artCharge = parseFloat(this.quoteData?.ArtCharge) || 0;
        if (artCharge > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'ARTWORK', 'Art Charge / Redraw', 1, artCharge, artCharge);
        }

        // 7. Rush Fee
        const rushFee = parseFloat(this.quoteData?.RushFee) || 0;
        if (rushFee > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'RUSH', 'Rush Fee', 1, rushFee, rushFee);
        }

        // 8. Sample Fee
        const sampleFee = parseFloat(this.quoteData?.SampleFee) || 0;
        const sampleQty = parseInt(this.quoteData?.SampleQty) || 1;
        if (sampleFee > 0) {
            const sampleUnitPrice = sampleQty > 0 ? sampleFee / sampleQty : sampleFee;
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'SAMPLE', 'Sample Fee', sampleQty, sampleUnitPrice, sampleFee);
        }

        // 9. LTM Fee - Garments
        const ltmGarment = parseFloat(this.quoteData?.LTM_Garment) || 0;
        const garmentQtyLTM = parseInt(this.quoteData?.ALGarmentQty) || totalQty || 0;
        if (ltmGarment > 0 && garmentQtyLTM > 0) {
            const ltmGarmentUnit = ltmGarment / garmentQtyLTM;
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'LTM-G', 'LTM Fee: Garments', garmentQtyLTM, ltmGarmentUnit, ltmGarment);
        }

        // 10. LTM Fee - Caps
        const ltmCap = parseFloat(this.quoteData?.LTM_Cap) || 0;
        const capQtyLTM = parseInt(this.quoteData?.ALCapQty) || 0;
        if (ltmCap > 0 && capQtyLTM > 0) {
            const ltmCapUnit = ltmCap / capQtyLTM;
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'LTM-C', 'LTM Fee: Caps', capQtyLTM, ltmCapUnit, ltmCap);
        }

        // 11. Discount (negative line item)
        const discount = parseFloat(this.quoteData?.Discount) || 0;
        const discountReason = this.quoteData?.DiscountReason || '';
        const discountPercent = parseFloat(this.quoteData?.DiscountPercent) || 0;
        if (discount > 0) {
            const discountDesc = discountPercent > 0
                ? `Discount (${discountPercent}%)`
                : 'Discount';
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'DISCOUNT', discountDesc, 1, -discount, -discount, true);
        }

        return yPos;
    }

    /**
     * Render a single fee row in PDF
     * @param {boolean} isDiscount - If true, row styled as discount (red/negative)
     */
    renderPdfFeeRow(pdf, yPos, colX, partNum, description, qty, unitPrice, total, isDiscount = false) {
        // Green italic style for fee rows, red for discounts
        pdf.setFont('helvetica', 'bolditalic');
        if (isDiscount) {
            pdf.setTextColor(220, 38, 38); // Red (#dc2626)
        } else {
            pdf.setTextColor(21, 128, 61); // Green (#15803d)
        }

        // Part number in style column
        pdf.text(partNum, colX.styleDesc + 2, yPos);

        // Description (truncated)
        pdf.setFont('helvetica', 'italic');
        const truncDesc = description.substring(0, 20);
        pdf.text(truncDesc, colX.color + 2, yPos);

        // Quantity in XXXL column (Size06 catch-all)
        pdf.text(String(qty), colX.xxxl + 3, yPos);

        // Qty column
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(qty), colX.qty + 4, yPos);

        // Unit price and total
        pdf.setFont('helvetica', 'normal');
        pdf.text(this.formatCurrency(unitPrice), colX.price, yPos);
        pdf.setFont('helvetica', 'bold');
        pdf.text(this.formatCurrency(total), colX.total, yPos);

        // Reset text color
        pdf.setTextColor(51, 51, 51);
        pdf.setFont('helvetica', 'normal');

        return yPos + 6;
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

    /**
     * Debug method to verify all charges are accounted for correctly
     * Called when quote data loads - check browser console for output
     */
    debugChargeVerification() {
        console.group('📊 CHARGE VERIFICATION AUDIT');

        const q = this.quoteData;

        // 1. Core amounts from Caspio
        console.group('1️⃣ Core Amounts (from Caspio)');
        const subtotal = parseFloat(q?.SubtotalAmount) || 0;
        const ltmFee = parseFloat(q?.LTMFeeTotal) || 0;
        const totalAmount = parseFloat(q?.TotalAmount) || 0;
        console.log('SubtotalAmount:', subtotal.toFixed(2));
        console.log('LTMFeeTotal:', ltmFee.toFixed(2));
        console.log('TotalAmount (grandTotal):', totalAmount.toFixed(2));
        console.groupEnd();

        // 2. Setup fees
        console.group('2️⃣ Setup Fees');
        const garmentDigitizing = parseFloat(q?.GarmentDigitizing) || 0;
        const capDigitizing = parseFloat(q?.CapDigitizing) || 0;
        const totalSetup = garmentDigitizing + capDigitizing;
        console.log('Garment Digitizing:', garmentDigitizing.toFixed(2));
        console.log('Cap Digitizing:', capDigitizing.toFixed(2));
        console.log('Total Setup:', totalSetup.toFixed(2));
        console.groupEnd();

        // 3. Additional Logo charges
        console.group('3️⃣ Additional Logo (AL) Charges');
        const alGarment = parseFloat(q?.ALChargeGarment) || 0;
        const alCap = parseFloat(q?.ALChargeCap) || 0;
        const totalAL = alGarment + alCap;
        console.log('AL Garment:', alGarment.toFixed(2));
        console.log('AL Cap:', alCap.toFixed(2));
        console.log('Total AL:', totalAL.toFixed(2));
        console.groupEnd();

        // 4. Extra stitch info (informational - already in unit prices)
        console.group('4️⃣ Extra Stitches (INFORMATIONAL ONLY)');
        const addlStitch = parseFloat(q?.AdditionalStitchCharge) || 0;
        const stitchCount = parseFloat(q?.StitchCount) || 8000;
        console.log('Stitch Count:', stitchCount);
        console.log('Extra Stitch Amount:', addlStitch.toFixed(2));
        console.log('⚠️ NOTE: Extra stitches are ALREADY baked into product unit prices');
        console.log('⚠️ This value is NOT added separately to the total');
        console.groupEnd();

        // 5. Other fees
        console.group('5️⃣ Other Fees');
        const artCharge = parseFloat(q?.ArtCharge) || 0;
        const rushFee = parseFloat(q?.RushFee) || 0;
        const sampleFee = parseFloat(q?.SampleFee) || 0;
        const discount = parseFloat(q?.Discount) || 0;
        console.log('Art Charge:', artCharge.toFixed(2));
        console.log('Rush Fee:', rushFee.toFixed(2));
        console.log('Sample Fee:', sampleFee.toFixed(2));
        console.log('Discount:', discount.toFixed(2));
        console.groupEnd();

        // 6. Product items calculation
        console.group('6️⃣ Product Items');
        let itemsTotal = 0;
        this.items.forEach((item, i) => {
            const lineTotal = parseFloat(item.LineTotal) || 0;
            itemsTotal += lineTotal;
            console.log(`  Item ${i + 1}: ${item.ProductSKU} x ${item.Quantity} @ $${item.UnitPrice} = $${lineTotal.toFixed(2)}`);
        });
        console.log('Items Total:', itemsTotal.toFixed(2));
        console.groupEnd();

        // 7. Verification math
        console.group('7️⃣ VERIFICATION');
        const expectedTotal = subtotal + ltmFee + totalSetup + totalAL + artCharge + rushFee + sampleFee - discount;
        console.log('Formula: subtotal + LTM + setup + AL + art + rush + sample - discount');
        console.log(`         ${subtotal.toFixed(2)} + ${ltmFee.toFixed(2)} + ${totalSetup.toFixed(2)} + ${totalAL.toFixed(2)} + ${artCharge.toFixed(2)} + ${rushFee.toFixed(2)} + ${sampleFee.toFixed(2)} - ${discount.toFixed(2)}`);
        console.log('Expected Total:', expectedTotal.toFixed(2));
        console.log('Actual TotalAmount:', totalAmount.toFixed(2));
        const diff = Math.abs(expectedTotal - totalAmount);
        if (diff < 0.01) {
            console.log('✅ PASS: Totals match!');
        } else {
            console.log('❌ FAIL: Difference of $' + diff.toFixed(2));
        }
        console.groupEnd();

        // 8. Tax calculation
        console.group('8️⃣ Tax Calculation');
        const taxRate = 0.101;
        const tax = totalAmount * taxRate;
        const grandTotalWithTax = totalAmount + tax;
        console.log('Tax Rate:', (taxRate * 100).toFixed(1) + '%');
        console.log('Tax Amount:', tax.toFixed(2));
        console.log('Grand Total (with tax):', grandTotalWithTax.toFixed(2));
        console.groupEnd();

        console.groupEnd(); // End main group
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new QuoteViewPage();
});
