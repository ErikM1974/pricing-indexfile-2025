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
        this.productItems = [];
        this.customerSuppliedItems = [];
        this.taxRate = 0.101; // 10.1% WA Sales Tax (default, may be overridden by TAX fee item)
        this.includeTax = true;

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

            // Read tax rate: prefer frozen TaxRate column, then TAX fee item, then default 10.1%
            if (this.quoteData.TaxRate != null && this.quoteData.TaxRate !== '') {
                this.taxRate = parseFloat(this.quoteData.TaxRate) || 0;
                this.includeTax = this.taxRate > 0;
            } else {
                const taxFeeItem = this.items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'TAX');
                if (taxFeeItem) {
                    this.taxRate = taxFeeItem.BaseUnitPrice / 100;
                    this.includeTax = this.taxRate > 0;
                }
            }

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
        // Header - include revision if > 1
        const revision = this.quoteData.RevisionNumber || 1;
        let headerText = `Quote #${this.quoteId}`;
        if (revision > 1) {
            headerText += ` • Rev ${revision}`;
        }
        document.getElementById('quote-id-header').textContent = headerText;

        // Set document title for PDF filename (Ctrl+P → Save as PDF)
        document.title = `Quote ${this.quoteId} - NWCA`;

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

        // PO Number (if available)
        const poNumber = this.quoteData.PurchaseOrderNumber || '';
        if (poNumber) {
            document.getElementById('po-number-display').textContent = poNumber;
            document.getElementById('po-number-row').style.display = 'block';
        }

        // Ship To card (show if address OR ship method present)
        const shipToAddress = this.quoteData.ShipToAddress || '';
        const shipToCity = this.quoteData.ShipToCity || '';
        const shipToState = this.quoteData.ShipToState || '';
        const shipToZip = this.quoteData.ShipToZip || '';
        const shipMethod = this.quoteData.ShipMethod || '';
        if (shipToAddress || shipToCity || shipMethod) {
            const shipCard = document.getElementById('ship-to-card');
            if (shipCard) {
                if (shipToAddress) {
                    document.getElementById('ship-to-address').textContent = shipToAddress;
                }
                const cityLine = [shipToCity, shipToState].filter(Boolean).join(', ') + (shipToZip ? ' ' + shipToZip : '');
                if (cityLine.trim()) {
                    document.getElementById('ship-to-city-state').textContent = cityLine;
                }
                if (shipMethod) {
                    document.getElementById('ship-to-method').textContent = 'Via: ' + shipMethod;
                }
                shipCard.style.display = 'block';
            }
        }

        // Order Number (if available)
        const orderNumber = this.quoteData.OrderNumber || '';
        if (orderNumber) {
            document.getElementById('order-number').textContent = orderNumber;
            document.getElementById('order-number-row').style.display = 'flex';
        }

        // Req Ship Date (if available)
        const reqShipDate = this.quoteData.ReqShipDate || '';
        if (reqShipDate) {
            document.getElementById('req-ship-date').textContent = this.formatDate(reqShipDate);
            document.getElementById('req-ship-date-row').style.display = 'flex';
        }

        // Drop Dead Date (if available)
        const dropDeadDate = this.quoteData.DropDeadDate || '';
        if (dropDeadDate) {
            document.getElementById('drop-dead-date').textContent = this.formatDate(dropDeadDate);
            document.getElementById('drop-dead-date-row').style.display = 'flex';
        }

        // Customer Number (if available)
        if (this.quoteData.CustomerNumber) {
            document.getElementById('customer-number-display').textContent = this.quoteData.CustomerNumber;
            document.getElementById('customer-number-row').style.display = 'flex';
        }

        // Payment Terms (if available)
        if (this.quoteData.PaymentTerms) {
            document.getElementById('payment-terms').textContent = this.quoteData.PaymentTerms;
            document.getElementById('payment-terms-row').style.display = 'flex';
        }

        // Revision info (if quote has been revised)
        if (revision > 1 && this.quoteData.RevisedAt) {
            const revisionRow = document.getElementById('revision-row');
            if (revisionRow) {
                document.getElementById('revised-date').textContent = this.formatDate(this.quoteData.RevisedAt);
                revisionRow.style.display = 'flex';
            }
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

        // Render Screen Print specs section if applicable
        this.renderScreenPrintSpecs();

        // Items - render as product cards with size matrix (async for image fetching)
        await this.renderItems();

        // Special notes (plain text from embroidery imports, etc.)
        this.renderNotes();

        // Design references (from ShopWorks import)
        this.renderDesignNumbers();

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
     * Only displays for DTF quotes, shows "Not specified" if no location data
     */
    renderDTFSpecs() {
        // Only show for DTF quotes
        const prefix = this.quoteId?.split(/[\d-]/)[0] || '';
        if (prefix !== 'DTF') {
            return;
        }

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

        // Get the DTF specs section from HTML
        const specsSection = document.getElementById('dtf-specs-section');
        const specsContainer = document.getElementById('dtf-specs-container');

        if (!specsSection || !specsContainer) {
            console.warn('DTF specs section not found in HTML');
            return;
        }

        // Show the section and populate it (with fallback for missing location data)
        specsSection.style.display = 'block';
        if (!locationCodes && !locationNames) {
            specsContainer.innerHTML = '<div class="dtf-location-item">• Transfer locations not specified</div>';
        } else {
            specsContainer.innerHTML = this.renderLocationList(locationCodes, locationNames, notes);
        }
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
     * Render Screen Print specifications section
     * Shows print locations and ink colors per location
     * Only displays for Screen Print quotes (SP prefix)
     */
    renderScreenPrintSpecs() {
        // Only show for Screen Print quotes
        const prefix = this.quoteId?.split(/[\d-]/)[0] || '';
        if (prefix !== 'SP' && prefix !== 'SPC') {
            return;
        }

        // Parse Notes JSON to get print setup info
        let notes = {};
        try {
            notes = this.quoteData.Notes ? JSON.parse(this.quoteData.Notes) : {};
        } catch (e) {
            console.warn('[QuoteView] Could not parse Screen Print Notes JSON:', e);
        }

        // Get the DTF specs section (reusing the same HTML element)
        // Note: We're repurposing the DTF specs section for Screen Print
        const specsSection = document.getElementById('dtf-specs-section');
        const specsContainer = document.getElementById('dtf-specs-container');

        if (!specsSection || !specsContainer) {
            console.warn('[QuoteView] Specs section not found in HTML');
            return;
        }

        // Build content based on available location data
        let html = '';

        // Check for front location
        if (notes.frontLocation) {
            const frontLabel = this.formatLocationCode(notes.frontLocation);
            const frontColors = notes.frontColors || 1;
            html += `<div class="dtf-location-item">• ${frontLabel} <span class="dtf-location-size">(${frontColors} color${frontColors !== 1 ? 's' : ''})</span></div>`;
        }

        // Check for back location
        if (notes.backLocation) {
            const backLabel = this.formatLocationCode(notes.backLocation);
            const backColors = notes.backColors || 1;
            html += `<div class="dtf-location-item">• ${backLabel} <span class="dtf-location-size">(${backColors} color${backColors !== 1 ? 's' : ''})</span></div>`;
        }

        // Fallback to locations array if no front/back
        if (!html && notes.locations && notes.locations.length > 0) {
            html = notes.locations.map(loc => {
                const label = this.formatLocationCode(loc);
                return `<div class="dtf-location-item">• ${label}</div>`;
            }).join('');
        }

        // Try to get from first item's PrintLocationName as last resort
        if (!html && this.items?.length > 0 && this.items[0]?.PrintLocationName) {
            const locationName = this.items[0].PrintLocationName;
            if (locationName && locationName !== 'Primary Location') {
                html = `<div class="dtf-location-item">• ${this.escapeHtml(locationName)}</div>`;
            }
        }

        // Show setup fees info if available
        const isDark = notes.isDarkGarment;
        const hasSafety = notes.hasSafetyStripes;
        if (isDark || hasSafety) {
            html += '<div class="dtf-location-item" style="margin-top: 8px; font-size: 12px; color: #666;">';
            if (isDark) html += '• Dark garment (includes underbase)';
            if (hasSafety) html += '• Safety stripes included';
            html += '</div>';
        }

        // Show the section with fallback message if no location data
        specsSection.style.display = 'block';
        if (!html) {
            specsContainer.innerHTML = '<div class="dtf-location-item">• Print locations not specified</div>';
        } else {
            specsContainer.innerHTML = html;
        }
    }

    /**
     * Render special notes section for plain-text notes (embroidery imports, etc.)
     * JSON notes (DTG/DTF/SP location config) are skipped — those are handled by renderDTFSpecs/renderScreenPrintSpecs.
     */
    renderNotes() {
        const rawNotes = this.quoteData?.Notes;
        if (!rawNotes) return;

        // Skip if Notes is valid JSON (structured config for DTG/DTF/SP)
        try { JSON.parse(rawNotes); return; } catch (e) { /* plain text — render it */ }

        const section = document.getElementById('special-notes-section');
        const content = document.getElementById('special-notes-content');
        if (!section || !content) return;

        content.textContent = rawNotes;
        section.style.display = 'block';
    }

    /**
     * Render design reference numbers if saved (from ShopWorks import)
     */
    renderDesignNumbers() {
        const raw = this.quoteData?.DesignNumbers;
        if (!raw) return;

        let designs;
        try { designs = JSON.parse(raw); } catch (e) { return; }
        if (!Array.isArray(designs) || designs.length === 0) return;

        // Render into the special-notes section (append below existing notes)
        const section = document.getElementById('special-notes-section');
        const content = document.getElementById('special-notes-content');
        if (!section || !content) return;

        const designHtml = designs.map(d => this.escapeHtml(d)).join('<br>');
        const block = document.createElement('div');
        block.style.marginTop = '12px';
        block.innerHTML = `<strong>Design References:</strong><br>${designHtml}`;
        content.appendChild(block);
        section.style.display = 'block';
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

        // Separate customer-supplied items (DECG/DECC) from regular products
        this.customerSuppliedItems = this.items.filter(item => item.EmbellishmentType === 'customer-supplied');
        this.productItems = this.items.filter(item =>
            item.EmbellishmentType !== 'customer-supplied' && item.EmbellishmentType !== 'fee');

        // Group regular product items by StyleNumber + Color
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
                            <th class="style-col">Item / Description</th>
                            <th class="color-col">Color</th>
                            <th class="size-col">S</th>
                            <th class="size-col">M</th>
                            <th class="size-col">L</th>
                            <th class="size-col">XL</th>
                            <th class="size-col">2XL</th>
                            <th class="size-col">3XL</th>
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

        // Render customer-supplied items (DECG/DECC) as service rows
        html += this.renderCustomerSuppliedRows();

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
     * Only shows stitch counts for embroidery quote types (EMB, EMBC, RICH, CAP)
     * Print quotes (DTG, DTF, SPC, SSC) show location only
     */
    renderEmbroideryInfo() {
        // Determine quote type from prefix
        const prefix = this.quoteId?.split(/[\d-]/)[0] || '';
        const isEmbroideryQuote = ['EMB', 'EMBC', 'RICH', 'CAP'].includes(prefix);

        // Check if this is a laser-patch order
        const capEmbellishmentType = this.quoteData?.CapEmbellishmentType || 'embroidery';
        const isLaserPatch = capEmbellishmentType === 'laser-patch';

        // For laser-patch orders, show simplified info (no stitches)
        if (isLaserPatch) {
            let html = `<div class="embroidery-info">`;
            html += `<div class="emb-detail"><span class="emb-label">Embellishment:</span> <span class="emb-value">Laser Leatherette Patch</span></div>`;
            html += `<div class="emb-detail"><span class="emb-label">Location:</span> <span class="emb-value">Cap Front</span></div>`;
            html += `</div>`;
            return html;
        }

        // Get location (common to all quote types)
        // DTG stores location in Notes JSON as 'locationName' or in items as 'PrintLocationName'
        let location = this.quoteData?.PrintLocation || this.quoteData?.LogoLocation;

        // Try to get from Notes JSON (DTG/DTF/Screen Print quotes)
        if (!location && this.quoteData?.Notes) {
            try {
                const notes = JSON.parse(this.quoteData.Notes);
                // DTG format
                location = notes.locationName || notes.locationNames || null;
                // Screen Print format - has locations array or frontLocation/backLocation
                if (!location && notes.locations && notes.locations.length > 0) {
                    location = this.formatScreenPrintLocations(notes.locations);
                }
                if (!location && (notes.frontLocation || notes.backLocation)) {
                    const parts = [];
                    if (notes.frontLocation) parts.push(this.formatLocationCode(notes.frontLocation));
                    if (notes.backLocation) parts.push(this.formatLocationCode(notes.backLocation));
                    location = parts.join(' + ');
                }
            } catch (e) { /* ignore parse errors */ }
        }

        // Try to get from first item's PrintLocationName
        if (!location && this.items?.length > 0) {
            location = this.items[0]?.PrintLocationName;
        }

        // Final fallback
        location = location || 'Left Chest';

        let html = `<div class="embroidery-info">`;
        html += `<div class="emb-detail"><span class="emb-label">Location:</span> <span class="emb-value">${this.escapeHtml(location)}</span></div>`;

        // Only show stitches and embroidery-specific fields for embroidery quotes
        if (isEmbroideryQuote) {
            const stitches = this.quoteData?.StitchCount || this.quoteData?.Stitches || '8000';
            const digitizing = this.quoteData?.DigitizingFee || 0;
            const addlLocation = this.quoteData?.AdditionalLogoLocation || '';
            const addlStitches = parseInt(this.quoteData?.AdditionalStitchCount) || 0;

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
            // Cap embroidery info (only show if there are actual caps in the quote)
            // Bug fix 2026-01-15: Previously showed cap info even for garment-only quotes
            // because CapStitchCount defaults to 8000. Now we check ALCapQty first.
            const capQty = parseInt(this.quoteData?.ALCapQty) || 0;
            const capLocation = this.quoteData?.CapPrintLocation || '';
            const capStitches = parseInt(this.quoteData?.CapStitchCount) || 0;
            const capDigitizing = this.quoteData?.CapDigitizingFee || 0;
            if (capQty > 0 && (capLocation || capStitches > 0)) {
                const capText = capLocation
                    ? `${this.escapeHtml(capLocation)} (${capStitches.toLocaleString()} stitches)`
                    : `${capStitches.toLocaleString()} stitches`;
                html += `<div class="emb-detail"><span class="emb-label">Cap Location:</span> <span class="emb-value">${capText}</span></div>`;
                if (capDigitizing > 0) {
                    html += `<div class="emb-detail"><span class="emb-label">Cap Digitizing:</span> <span class="emb-value">${this.formatCurrency(capDigitizing)}</span></div>`;
                }
            }
        }

        html += `</div>`;
        return html;
    }

    /**
     * Render customer-supplied items (DECG/DECC) as service rows in the product table
     */
    renderCustomerSuppliedRows() {
        if (!this.customerSuppliedItems || this.customerSuppliedItems.length === 0) {
            return '';
        }

        let html = '';
        this.customerSuppliedItems.forEach(item => {
            const styleNumber = item.StyleNumber || 'DECG';
            const description = item.ProductName || 'Customer-Supplied Item';
            const qty = parseInt(item.Quantity) || 0;
            const unitPrice = item.FinalUnitPrice || item.BaseUnitPrice || 0;
            const lineTotal = item.LineTotal || (qty * unitPrice);
            const isDECC = styleNumber === 'DECC';
            const displayLabel = isDECC ? 'Customer Caps' : 'Customer Garments';

            html += `
                <tr class="customer-supplied-row" style="background: ${isDECC ? '#eff6ff' : '#fffbeb'};">
                    <td class="style-col" style="font-weight: 600; color: ${isDECC ? '#1e40af' : '#92400e'};">
                        ${this.escapeHtml(displayLabel)}
                    </td>
                    <td class="color-col" style="font-size: 11px;">${this.escapeHtml(description)}</td>
                    <td class="size-col" colspan="6" style="text-align: center; color: #94a3b8; font-size: 10px; font-style: italic;">
                        Customer-supplied
                    </td>
                    <td class="qty-col">${qty}</td>
                    <td class="price-col">${this.formatCurrency(unitPrice)}</td>
                    <td class="total-col">${this.formatCurrency(lineTotal)}</td>
                </tr>
            `;
        });

        return html;
    }

    /**
     * Render fee charges as line items in the product table
     * Part # | Description | S | M | LG | XL | XXL | XXXL | Qty | Unit $ | Total
     * Quantity goes in XXXL column (Size06 catch-all per ShopWorks)
     */
    renderFeeRows() {
        let html = '';

        // CHANGED 2026-01-14: Split stitch charges by garment/cap per ShopWorks naming standard
        // AS-GARM = Additional Stitches in Garment Logo, AS-CAP = Additional Stitches in Cap Logo
        // CHANGED 2026-01-15: Display per-item breakdown instead of flat fee for transparency
        const garmentStitchCharge = parseFloat(this.quoteData?.GarmentStitchCharge) || 0;
        const capStitchCharge = parseFloat(this.quoteData?.CapStitchCharge) || 0;
        const stitchGarmentQty = parseInt(this.quoteData?.ALGarmentQty) || 1;
        const stitchCapQty = parseInt(this.quoteData?.ALCapQty) || 1;

        if (garmentStitchCharge > 0) {
            // Show per-shirt breakdown: qty × unit price = total
            const stitchUnitPrice = stitchGarmentQty > 0 ? garmentStitchCharge / stitchGarmentQty : garmentStitchCharge;
            // Calculate extra stitch count for description (stitches above 8K base)
            const totalStitches = parseInt(this.quoteData?.StitchCount) || 8000;
            const extraStitchesK = Math.round((totalStitches - 8000) / 1000);
            const stitchDesc = extraStitchesK > 0
                ? `Additional Stitches (+${extraStitchesK}K)`
                : 'Additional Stitches in Garment Logo';
            html += this.renderFeeRow('AS-GARM', stitchDesc, stitchGarmentQty, stitchUnitPrice, garmentStitchCharge);
        }
        if (capStitchCharge > 0) {
            // Show per-cap breakdown: qty × unit price = total
            const capStitchUnitPrice = stitchCapQty > 0 ? capStitchCharge / stitchCapQty : capStitchCharge;
            // Calculate extra stitch count for description (stitches above 8K base)
            const capTotalStitches = parseInt(this.quoteData?.CapStitchCount) || 8000;
            const capExtraStitchesK = Math.round((capTotalStitches - 8000) / 1000);
            const capStitchDesc = capExtraStitchesK > 0
                ? `Additional Stitches (+${capExtraStitchesK}K)`
                : 'Additional Stitches in Cap Logo';
            html += this.renderFeeRow('AS-CAP', capStitchDesc, stitchCapQty, capStitchUnitPrice, capStitchCharge);
        }

        // 1. AL Garment Charge (Additional Logo on garments) - ShopWorks SKU: AL-GARM
        const alGarmentCharge = parseFloat(this.quoteData?.ALChargeGarment) || 0;
        const garmentQty = parseInt(this.quoteData?.ALGarmentQty) || 0;
        if (alGarmentCharge > 0 && garmentQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALGarmentUnitPrice) || (alGarmentCharge / garmentQty);
            // Show stitch count for additional logo (from AdditionalStitchCount field)
            const alStitchCount = parseInt(this.quoteData?.AdditionalStitchCount) || 8000;
            const alStitchK = Math.round(alStitchCount / 1000);
            const alDesc = alStitchK > 0
                ? `Additional Logo (${alStitchK}K stitches)`
                : 'Additional Logo - Garments';
            html += this.renderFeeRow('AL-GARM', alDesc, garmentQty, unitPrice, alGarmentCharge);
        }

        // 2. Cap Back Embroidery (Additional Logo on caps) - ShopWorks SKU: CB
        const alCapCharge = parseFloat(this.quoteData?.ALChargeCap) || 0;
        const capQty = parseInt(this.quoteData?.ALCapQty) || 0;
        if (alCapCharge > 0 && capQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALCapUnitPrice) || (alCapCharge / capQty);
            // Show stitch count for cap back embroidery
            const cbStitchCount = parseInt(this.quoteData?.CapStitchCount) || 8000;
            const cbStitchK = Math.round(cbStitchCount / 1000);
            const cbDesc = cbStitchK > 0
                ? `Cap Back Embroidery (${cbStitchK}K stitches)`
                : 'Cap Back Embroidery';
            html += this.renderFeeRow('CB', cbDesc, capQty, unitPrice, alCapCharge);
        }

        // 3. Digitizing Setup Garments - ShopWorks SKU: DD
        const garmentDigitizing = parseFloat(this.quoteData?.GarmentDigitizing) || 0;
        if (garmentDigitizing > 0) {
            html += this.renderFeeRow('DD', 'Digitizing Setup Garments', 1, garmentDigitizing, garmentDigitizing);
        }

        // 4. Cap Setup Fee - DD-CAP for embroidery, GRT-50 for laser-patch
        const capDigitizing = parseFloat(this.quoteData?.CapDigitizing) || 0;
        if (capDigitizing > 0) {
            const capEmbellishmentType = this.quoteData?.CapEmbellishmentType || 'embroidery';
            if (capEmbellishmentType === 'laser-patch') {
                // Laser patch uses GRT-50 / Laser Patch Setup
                html += this.renderFeeRow('GRT-50', 'Laser Patch Setup', 1, capDigitizing, capDigitizing);
            } else {
                // Standard embroidery uses DD-CAP / Digitizing Setup Cap
                html += this.renderFeeRow('DD-CAP', 'Digitizing Setup Cap', 1, capDigitizing, capDigitizing);
            }
        }

        // 4b. 3D Puff Embroidery Upcharge (from saved fee items)
        const puffFeeItem = this.items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === '3D-EMB');
        if (puffFeeItem && puffFeeItem.LineTotal > 0) {
            html += this.renderFeeRow('3D-EMB', '3D Puff Embroidery Upcharge',
                puffFeeItem.Quantity, puffFeeItem.FinalUnitPrice, puffFeeItem.LineTotal);
        }

        // 4c. Laser Leatherette Patch Upcharge (from saved fee items)
        const patchFeeItem = this.items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'Laser Patch');
        if (patchFeeItem && patchFeeItem.LineTotal > 0) {
            html += this.renderFeeRow('Laser Patch', 'Laser Leatherette Patch Upcharge',
                patchFeeItem.Quantity, patchFeeItem.FinalUnitPrice, patchFeeItem.LineTotal);
        }

        // 5. Logo Mockup & Print Review - ShopWorks SKU: GRT-50
        const artCharge = parseFloat(this.quoteData?.ArtCharge) || 0;
        if (artCharge > 0) {
            html += this.renderFeeRow('GRT-50', 'Logo Mockup & Print Review', 1, artCharge, artCharge);
        }

        // 6. Graphic Design Services - ShopWorks SKU: GRT-75 @ $75/hr
        const graphicDesignHours = parseFloat(this.quoteData?.GraphicDesignHours) || 0;
        const graphicDesignCharge = parseFloat(this.quoteData?.GraphicDesignCharge) || 0;
        if (graphicDesignCharge > 0) {
            const desc = graphicDesignHours > 0
                ? `Graphic design services (${graphicDesignHours} hrs @ $75/hr)`
                : 'Graphic design services';
            html += this.renderFeeRow('GRT-75', desc, graphicDesignHours || 1, 75, graphicDesignCharge);
        }

        // 7. Rush Fee (expedited processing) - ShopWorks SKU: RUSH
        const rushFee = parseFloat(this.quoteData?.RushFee) || 0;
        if (rushFee > 0) {
            html += this.renderFeeRow('RUSH', 'Rush Fee', 1, rushFee, rushFee);
        }

        // NOTE: Shipping fee shown in totals section only (not as fee line item)

        // NOTE: Sample Fee removed from UI per user request (2026-01-14)

        // 8. Less than minimum fee garments - ShopWorks SKU: LTM
        // Display as flat fee (qty=1) per user request - not distributed per-piece
        const ltmGarment = parseFloat(this.quoteData?.LTM_Garment) || 0;
        if (ltmGarment > 0) {
            html += this.renderFeeRow('LTM', 'Less than minimum fee garments', 1, ltmGarment, ltmGarment);
        }

        // 9. Less than minimum fee Caps - ShopWorks SKU: LTM-CAP
        // Display as flat fee (qty=1) per user request - not distributed per-piece
        const ltmCap = parseFloat(this.quoteData?.LTM_Cap) || 0;
        if (ltmCap > 0) {
            html += this.renderFeeRow('LTM-CAP', 'Less than minimum fee Caps', 1, ltmCap, ltmCap);
        }

        // 10. Discount (negative line item) - ShopWorks SKU: DISCOUNT
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
                <td class="size-col"></td>
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
            // Calculate per-unit price from stored LineTotal when available (ensures unit × qty = total)
            const unitPrice = item.BaseUnitPrice || item.FinalUnitPrice || 0;
            const perUnitTotal = (item.LineTotal && item.Quantity > 0)
                ? item.LineTotal / item.Quantity
                : unitPrice;

            Object.entries(breakdown).forEach(([size, qty]) => {
                if (qty > 0) {
                    if (!allSizes[size]) {
                        allSizes[size] = { qty: 0, price: 0, total: 0 };
                    }
                    allSizes[size].qty += qty;
                    // Use BaseUnitPrice so LTM is shown separately in LTM-G row
                    allSizes[size].price = unitPrice;
                    // Use proportional LineTotal to ensure unit × qty = total
                    allSizes[size].total += (qty * perUnitTotal);
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
        // Size06: Everything else (3XL+, OSFA, combo sizes, tall sizes) - the catch-all column
        const extendedSizes = [
            // Extended large
            '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL', 'XXXL',
            // Tall sizes (CRITICAL for tall-only products like TLCS410)
            'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
            // One-size
            'OSFA', 'OSFM', 'ONE SIZE', 'ADJ',
            // Combos (for fitted caps)
            'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
            // Youth
            'YXS', 'YS', 'YM', 'YL', 'YXL',
            // Toddler
            '2T', '3T', '4T', '5T', '5/6T', '6T',
            // Big
            'LB', 'XLB', '2XLB',
            // Extra small
            'XXS', '2XS', 'XS'
        ];
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
        // XXXL column is the catch-all (Size06): 3XL+, tall sizes, OSFA, combo sizes
        const xxxlCol = row.sizes['3XL'] || row.sizes['4XL'] || row.sizes['5XL'] || row.sizes['6XL']
                     || row.sizes['LT'] || row.sizes['XLT'] || row.sizes['2XLT'] || row.sizes['3XLT']
                     || row.sizes['4XLT'] || row.sizes['5XLT'] || row.sizes['6XLT']
                     || row.sizes['OSFA'] || row.sizes['S/M'] || row.sizes['M/L'] || row.sizes['L/XL']
                     || row.sizes['ONE SIZE'] || row.sizes['ADJ'] || '';

        // Style column with clickable image for first row (opens modal)
        let styleCell;
        if (isFirstRow) {
            styleCell = `
                <td class="style-col clickable" onclick="window.quoteViewPage.openProductModal(${groupIndex})">
                    <div class="style-with-image">
                        <img id="product-image-${groupIndex}" class="product-thumb" src="/pages/images/product-placeholder.png" alt="${this.escapeHtml(row.style)}">
                        <span>${this.escapeHtml(row.style)} - ${this.escapeHtml(row.description || '')}</span>
                    </div>
                </td>
            `;
        } else {
            styleCell = `<td class="style-col ext-style">${this.escapeHtml(row.style)} - ${this.escapeHtml(row.description || '')}</td>`;
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

        // Use productItems (excludes customer-supplied) if available, fall back to all items
        const items = this.productItems || this.items;
        items.forEach(item => {
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
                    // Use BaseUnitPrice so LTM is shown separately in LTM-G row
                    unitPrice: item.BaseUnitPrice || item.FinalUnitPrice || 0,
                    total: item.LineTotal || (item.Quantity * (item.BaseUnitPrice || item.FinalUnitPrice || 0)) || 0,
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
            // Use BaseUnitPrice so LTM is shown separately in LTM-G row
            html += `<td class="price-col">${this.formatCurrency(item.BaseUnitPrice || item.FinalUnitPrice || 0)}</td>`;
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
            // Use BaseUnitPrice so LTM is shown separately in LTM-G row
            const unitPrice = item.BaseUnitPrice || item.FinalUnitPrice || 0;

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
        // Prefer BaseUnitPrice so LTM is shown separately in LTM-G row
        const itemsWithBasePrice = this.items.filter(i =>
            i.BaseUnitPrice && i.BaseUnitPrice > 0 && i.EmbellishmentType !== 'fee');
        if (itemsWithBasePrice.length > 0) {
            return Math.min(...itemsWithBasePrice.map(i => i.BaseUnitPrice));
        }
        // Fallback to FinalUnitPrice if BaseUnitPrice not available
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
        // Prefer BaseUnitPrice so LTM is shown separately in LTM-G row
        if (item.BaseUnitPrice && item.BaseUnitPrice > 0) {
            return item.BaseUnitPrice;
        }
        // Fallback to FinalUnitPrice if BaseUnitPrice not available
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
     * Get shipping fee from SHIP fee line item (if present)
     */
    getShippingFee() {
        const shipItem = this.items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'SHIP');
        return (shipItem && shipItem.LineTotal > 0) ? parseFloat(shipItem.LineTotal) : 0;
    }

    /**
     * Calculate total with tax (shipping is taxable in WA state)
     */
    calculateTotalWithTax() {
        const subtotal = parseFloat(this.quoteData.TotalAmount) || 0;
        const shippingFee = this.getShippingFee();
        const taxableAmount = subtotal + shippingFee;
        const taxAmount = Math.round(taxableAmount * this.taxRate * 100) / 100;
        return taxableAmount + taxAmount;
    }

    /**
     * Render totals section with tax
     */
    renderTotals() {
        // Use TotalAmount as the pre-tax subtotal for display
        // TotalAmount includes: products + LTM + digitizing + art + rush + sample - discount
        // This ensures the displayed Subtotal matches the visible line items
        const grandTotalBeforeTax = parseFloat(this.quoteData.TotalAmount) || 0;
        const shippingFee = this.getShippingFee();
        const taxableAmount = grandTotalBeforeTax + shippingFee;
        const taxAmount = Math.round(taxableAmount * this.taxRate * 100) / 100;
        const totalWithTax = taxableAmount + taxAmount;

        // Build totals HTML
        const totalsCard = document.querySelector('.totals-card');
        let totalsHtml = '';

        // Show pre-tax total as Subtotal (all fees included)
        // This makes the math visually add up: visible rows = Subtotal
        totalsHtml += `
            <div class="total-row">
                <span class="label">Subtotal:</span>
                <span class="value">${this.formatCurrency(grandTotalBeforeTax)}</span>
            </div>
        `;

        // LTM no longer shown here - it's now a line item (LTM-G, LTM-C) in the product table

        // Shipping row before tax (so customer sees tax applies to subtotal + shipping)
        if (shippingFee > 0) {
            totalsHtml += `
                <div class="total-row">
                    <span class="label">Shipping:</span>
                    <span class="value">${this.formatCurrency(shippingFee)}</span>
                </div>
            `;
        }

        // Add tax row with dynamic rate label
        if (this.taxRate > 0) {
            const ratePercent = (this.taxRate * 100).toFixed(1);
            const rateLabel = ratePercent === '10.1' ? 'WA Sales Tax (10.1%)' : `Sales Tax (${ratePercent}%)`;
            totalsHtml += `
                <div class="total-row tax-row">
                    <span class="label">${rateLabel}:</span>
                    <span class="value">${this.formatCurrency(taxAmount)}</span>
                </div>
            `;
        } else {
            totalsHtml += `
                <div class="total-row tax-row">
                    <span class="label">Out of State Sales:</span>
                    <span class="value">$0.00</span>
                </div>
            `;
        }

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
        const pdfPO = this.quoteData.PurchaseOrderNumber || '';
        const quoteHeaderText = pdfPO ? `Quote #${this.quoteId}  |  PO# ${pdfPO}` : `Quote #${this.quoteId}`;
        pdf.text(quoteHeaderText, pageWidth - margin, 14, { align: 'right' });

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
        if (this.quoteData.Phone) {
            pdf.text(this.formatPhone(this.quoteData.Phone), margin, yPos);
            yPos += 5;
        }

        // Ship To block (below Prepared For, if address or ship method present)
        const pdfShipAddr = this.quoteData.ShipToAddress || '';
        const pdfShipCity = this.quoteData.ShipToCity || '';
        if (pdfShipAddr || pdfShipCity || this.quoteData.ShipMethod) {
            yPos += 3;
            pdf.setFont('helvetica', 'bold');
            pdf.text('SHIP TO', margin, yPos);
            yPos += 6;
            pdf.setFont('helvetica', 'normal');
            if (pdfShipAddr) {
                pdf.text(pdfShipAddr, margin, yPos);
                yPos += 5;
            }
            const pdfCityLine = [pdfShipCity, this.quoteData.ShipToState].filter(Boolean).join(', ') +
                (this.quoteData.ShipToZip ? ' ' + this.quoteData.ShipToZip : '');
            if (pdfCityLine.trim()) {
                pdf.text(pdfCityLine, margin, yPos);
                yPos += 5;
            }
            if (this.quoteData.ShipMethod) {
                pdf.setFont('helvetica', 'italic');
                pdf.text('Via: ' + this.quoteData.ShipMethod, margin, yPos);
                pdf.setFont('helvetica', 'normal');
                yPos += 5;
            }
        }

        // Quote Details (right side)
        const rightCol = pageWidth - margin - 50;
        pdf.setFont('helvetica', 'bold');
        pdf.text('QUOTE DETAILS', rightCol, 50);

        pdf.setFont('helvetica', 'normal');
        let detailY = 56;
        pdf.text(`Type: ${this.getQuoteType()}`, rightCol, detailY);
        detailY += 6;
        pdf.text(`Created: ${this.formatDate(this.quoteData.CreatedAt_Quote)}`, rightCol, detailY);
        detailY += 6;
        pdf.text(`Valid Until: ${this.formatDate(this.quoteData.ExpiresAt)}`, rightCol, detailY);
        detailY += 6;

        // Add Sales Rep if available
        const salesRep = this.quoteData.SalesRepName || this.quoteData.SalesRep || '';
        if (salesRep) {
            pdf.text(`Sales Rep: ${salesRep}`, rightCol, detailY);
            detailY += 6;
        }

        // Customer Number if available
        if (this.quoteData.CustomerNumber) {
            pdf.text(`Customer #: ${this.quoteData.CustomerNumber}`, rightCol, detailY);
            detailY += 6;
        }

        // Payment Terms if available
        if (this.quoteData.PaymentTerms) {
            pdf.text(`Terms: ${this.quoteData.PaymentTerms}`, rightCol, detailY);
            detailY += 6;
        }

        // Order Number if available
        if (this.quoteData.OrderNumber) {
            pdf.text(`Order #: ${this.quoteData.OrderNumber}`, rightCol, detailY);
            detailY += 6;
        }

        // Req Ship Date if available
        if (this.quoteData.ReqShipDate) {
            pdf.text(`Req Ship Date: ${this.formatDate(this.quoteData.ReqShipDate)}`, rightCol, detailY);
            detailY += 6;
        }

        // Drop Dead Date if available
        if (this.quoteData.DropDeadDate) {
            pdf.text(`Drop Dead: ${this.formatDate(this.quoteData.DropDeadDate)}`, rightCol, detailY);
            detailY += 6;
        }

        yPos = Math.max(yPos, detailY + 6);

        // Divider
        pdf.setDrawColor(76, 179, 84);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;

        // Embroidery Details Section (for embroidery and laser-patch quotes)
        const quoteType = this.getQuoteType();
        if (quoteType === 'Embroidery' || quoteType === 'Customer Supplied Embroidery' || quoteType === 'Laser Patch') {
            const isLaserPatch = quoteType === 'Laser Patch';

            // Laser patch gets simplified details section
            if (isLaserPatch) {
                const boxHeight = 16;
                pdf.setFillColor(248, 250, 252); // Light blue-gray background
                pdf.rect(margin, yPos - 2, pageWidth - margin * 2, boxHeight, 'F');

                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(51, 51, 51);
                pdf.text('LASER PATCH DETAILS', margin + 3, yPos + 4);

                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text('Embellishment: Laser Leatherette Patch', margin + 3, yPos + 11);
                pdf.text('Location: Cap Front', margin + 70, yPos + 11);

                yPos += boxHeight + 4;
            } else {
                // Standard embroidery details
                // Get embroidery details from quote data
                const location = this.quoteData?.PrintLocation || this.quoteData?.LogoLocation || 'Left Chest';
                const stitches = this.quoteData?.StitchCount || this.quoteData?.Stitches || '8000';
                const digitizing = parseFloat(this.quoteData?.DigitizingFee) || 0;
                const additionalStitchCharge = parseFloat(this.quoteData?.AdditionalStitchCharge) || 0;
                const addlLocation = this.quoteData?.AdditionalLogoLocation || '';
                const addlStitches = parseInt(this.quoteData?.AdditionalStitchCount) || 0;
                // Cap embroidery details (only show if there are actual caps in the quote)
                // Bug fix 2026-01-15: Check ALCapQty to prevent showing cap info for garment-only quotes
                const capQtyPdf = parseInt(this.quoteData?.ALCapQty) || 0;
                const capLocation = this.quoteData?.CapPrintLocation || '';
                const capStitches = parseInt(this.quoteData?.CapStitchCount) || 0;
                const capDigitizing = parseFloat(this.quoteData?.CapDigitizingFee) || 0;

                // Calculate box height: base 22mm, add 6mm for each extra row
                const hasAddlLogo = addlLocation || addlStitches > 0;
                const hasCapLogo = capQtyPdf > 0 && (capLocation || capStitches > 0);
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
            } // end else (standard embroidery)
        } // end if quoteType is embroidery/laser-patch

        // Print Details Section (for DTG, DTF, Screen Print quotes)
        const printQuoteTypes = ['Direct-to-Garment', 'Direct-to-Film', 'Screen Print', 'Contract Screen Print'];
        if (printQuoteTypes.includes(quoteType)) {
            // Parse Notes JSON for detailed config
            let notes = {};
            try {
                notes = this.quoteData?.Notes ? JSON.parse(this.quoteData.Notes) : {};
            } catch (e) { /* ignore parse errors */ }

            // Get location using same logic as web view (Notes JSON or items)
            let printLocation = this.quoteData?.PrintLocation || this.quoteData?.LogoLocation;
            if (!printLocation) {
                printLocation = notes.locationName || notes.locationNames || null;
            }
            if (!printLocation && this.items?.length > 0) {
                printLocation = this.items[0]?.PrintLocationName;
            }
            printLocation = printLocation || 'Left Chest';

            // Check if this is Screen Print with detailed config
            const isScreenPrint = quoteType === 'Screen Print' || quoteType === 'Contract Screen Print';
            const hasFrontLocation = notes.frontLocation;
            const hasBackLocation = notes.backLocation;

            // Calculate box height based on content
            let boxHeight = 16;
            if (isScreenPrint && (hasFrontLocation || hasBackLocation)) {
                boxHeight = 26;
                if (notes.isDarkGarment || notes.hasSafetyStripes) boxHeight += 6;
            }

            // Render box with print details
            pdf.setFillColor(248, 250, 252); // Light blue-gray background
            pdf.rect(margin, yPos - 2, pageWidth - margin * 2, boxHeight, 'F');

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(51, 51, 51);
            pdf.text('PRINT DETAILS', margin + 3, yPos + 4);

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');

            if (isScreenPrint && (hasFrontLocation || hasBackLocation)) {
                // Screen Print with detailed front/back config
                let detailY = yPos + 11;

                if (hasFrontLocation) {
                    const frontLabel = this.formatLocationCode(notes.frontLocation);
                    const frontColors = notes.frontColors || 1;
                    pdf.text(`Front: ${frontLabel} (${frontColors} color${frontColors !== 1 ? 's' : ''})`, margin + 3, detailY);
                    detailY += 5;
                }

                if (hasBackLocation) {
                    const backLabel = this.formatLocationCode(notes.backLocation);
                    const backColors = notes.backColors || 1;
                    pdf.text(`Back: ${backLabel} (${backColors} color${backColors !== 1 ? 's' : ''})`, margin + 3, detailY);
                    detailY += 5;
                }

                // Dark garment and safety stripes
                let extras = [];
                if (notes.isDarkGarment) extras.push('Dark garment (+underbase)');
                if (notes.hasSafetyStripes) extras.push('Safety stripes');
                if (extras.length > 0) {
                    pdf.setFontSize(7);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text(extras.join(' • '), margin + 3, detailY);
                }
            } else if (quoteType === 'Direct-to-Film' && notes.selectedLocations?.length > 0) {
                // DTF with transfer locations
                const locationLabels = notes.selectedLocations.map(loc => {
                    const config = {
                        'left-chest': 'Left Chest (S)',
                        'right-chest': 'Right Chest (S)',
                        'center-front': 'Center Front (M)',
                        'center-back': 'Center Back (M)',
                        'full-front': 'Full Front (L)',
                        'full-back': 'Full Back (L)',
                        'left-sleeve': 'Left Sleeve (S)',
                        'right-sleeve': 'Right Sleeve (S)',
                        'back-of-neck': 'Back of Neck (S)'
                    };
                    return config[loc] || loc;
                });
                pdf.text(`Locations: ${locationLabels.join(', ')}`, margin + 3, yPos + 11);
            } else {
                // Basic location display
                pdf.text(`Location: ${printLocation}`, margin + 3, yPos + 11);
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
        // Size columns centered (each size col is 7mm wide, qty col is 12mm)
        const sizeW = 7;
        const qtyW = colX.price - colX.qty;
        pdf.text('S', colX.s + sizeW / 2, yPos, { align: 'center' });
        pdf.text('M', colX.m + sizeW / 2, yPos, { align: 'center' });
        pdf.text('L', colX.lg + sizeW / 2, yPos, { align: 'center' });
        pdf.text('XL', colX.xl + sizeW / 2, yPos, { align: 'center' });
        pdf.text('2X', colX.xxl + sizeW / 2, yPos, { align: 'center' });
        pdf.text('3X+', colX.xxxl + (colX.qty - colX.xxxl) / 2, yPos, { align: 'center' });
        pdf.text('Qty', colX.qty + qtyW / 2, yPos, { align: 'center' });
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

                // Truncate description to fit (increased to 28 chars for long names like "Carhartt Rain Defender Paxt...")
                const truncDesc = (row.description || '').substring(0, 28);
                const styleDesc = `${row.style} - ${truncDesc}`;

                pdf.setFontSize(7);
                if (i === 0) {
                    pdf.setFont('helvetica', 'bold');
                } else {
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(180, 83, 9); // Orange for extended
                }

                // Combined style/description column (increased to 42 chars — fits ~58mm at font 7)
                pdf.text(styleDesc.substring(0, 42), colX.styleDesc + 2, yPos);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(51, 51, 51);
                // Color column (increased from 10 to 16 chars for combos like "White/Charcoal")
                pdf.text(row.color.substring(0, 16), colX.color + 2, yPos);

                // Size columns (centered to match headers)
                pdf.text(String(sCol), colX.s + sizeW / 2, yPos, { align: 'center' });
                pdf.text(String(mCol), colX.m + sizeW / 2, yPos, { align: 'center' });
                pdf.text(String(lgCol), colX.lg + sizeW / 2, yPos, { align: 'center' });
                pdf.text(String(xlCol), colX.xl + sizeW / 2, yPos, { align: 'center' });
                pdf.text(String(xxlCol), colX.xxl + sizeW / 2, yPos, { align: 'center' });
                pdf.text(String(xxxlCol), colX.xxxl + (colX.qty - colX.xxxl) / 2, yPos, { align: 'center' });
                // Qty, Price, Total - properly spaced
                pdf.setFont('helvetica', 'bold');
                pdf.text(String(row.qty), colX.qty + qtyW / 2, yPos, { align: 'center' });
                pdf.setFont('helvetica', 'normal');
                pdf.text(this.formatCurrency(row.unitPrice), colX.price, yPos);
                pdf.setTextColor(76, 179, 84);
                pdf.text(this.formatCurrency(row.lineTotal), colX.total, yPos);
                pdf.setTextColor(51, 51, 51);

                yPos += 6;
            });
        });

        // Customer-supplied items (DECG/DECC)
        yPos = this.renderPdfCustomerSuppliedRows(pdf, yPos, colX);

        // Fee line items (Additional Stitches, AL charges, Digitizing)
        yPos = this.renderPdfFeeRows(pdf, yPos, colX);

        // Totals
        yPos += 5;
        pdf.setDrawColor(76, 179, 84);
        pdf.line(margin + 100, yPos, pageWidth - margin, yPos);
        yPos += 8;

        // Use TotalAmount as pre-tax subtotal (includes all fees)
        // This matches the visible line items in the PDF
        const grandTotal = parseFloat(this.quoteData.TotalAmount) || 0;
        const pdfShippingFee = this.getShippingFee();
        const pdfTaxableAmount = grandTotal + pdfShippingFee;
        const taxAmount = Math.round(pdfTaxableAmount * this.taxRate * 100) / 100;
        const totalWithTax = pdfTaxableAmount + taxAmount;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        // Show pre-tax total as Subtotal (all fees included)
        pdf.text('Subtotal:', margin + 120, yPos);
        pdf.text(this.formatCurrency(grandTotal), margin + 155, yPos);
        yPos += 6;

        // Shipping line before tax (so customer sees tax applies to subtotal + shipping)
        if (pdfShippingFee > 0) {
            pdf.text('Shipping:', margin + 120, yPos);
            pdf.text(this.formatCurrency(pdfShippingFee), margin + 155, yPos);
            yPos += 6;
        }

        // Tax line in PDF
        if (this.taxRate > 0) {
            const pdfRatePercent = (this.taxRate * 100).toFixed(1);
            const pdfRateLabel = pdfRatePercent === '10.1' ? 'WA Sales Tax (10.1%):' : `Sales Tax (${pdfRatePercent}%):`;
            pdf.text(pdfRateLabel, margin + 100, yPos);
            pdf.text(this.formatCurrency(taxAmount), margin + 155, yPos);
            yPos += 6;
        } else {
            pdf.text('Out of State Sales:', margin + 100, yPos);
            pdf.text('$0.00', margin + 155, yPos);
            yPos += 6;
        }
        yPos += 2;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('TOTAL:', margin + 120, yPos);
        pdf.setTextColor(76, 179, 84);
        pdf.text(this.formatCurrency(totalWithTax), margin + 155, yPos);
        yPos += 10;

        // Special Notes (plain text only — skip JSON config notes)
        const rawNotes = this.quoteData?.Notes;
        if (rawNotes) {
            let isJson = false;
            try { JSON.parse(rawNotes); isJson = true; } catch (e) { /* plain text */ }
            if (!isJson) {
                if (yPos > 240) { pdf.addPage(); yPos = 20; }
                pdf.setFillColor(255, 249, 196);
                const noteLines = pdf.splitTextToSize(rawNotes, pageWidth - margin * 2 - 10);
                const boxHeight = Math.min(noteLines.length * 4 + 12, 40);
                pdf.rect(margin, yPos - 2, pageWidth - margin * 2, boxHeight, 'F');
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(146, 64, 14);
                pdf.text('Special Notes', margin + 4, yPos + 4);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(120, 53, 15);
                pdf.text(noteLines, margin + 4, yPos + 9);
                yPos += boxHeight + 4;
            }
        }

        // Design References in PDF (from ShopWorks import)
        const rawDesigns = this.quoteData?.DesignNumbers;
        if (rawDesigns) {
            try {
                const designs = JSON.parse(rawDesigns);
                if (Array.isArray(designs) && designs.length > 0) {
                    if (yPos > 240) { pdf.addPage(); yPos = 20; }
                    pdf.setFontSize(8);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(51, 51, 51);
                    pdf.text('Design References:', margin, yPos + 4);
                    pdf.setFont('helvetica', 'normal');
                    yPos += 8;
                    for (const design of designs) {
                        pdf.text(design, margin + 4, yPos);
                        yPos += 4;
                    }
                    yPos += 4;
                }
            } catch (e) { /* not valid JSON, skip */ }
        }

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
     * Render customer-supplied items (DECG/DECC) in PDF
     * @returns {number} Updated yPos after rendering rows
     */
    renderPdfCustomerSuppliedRows(pdf, yPos, colX) {
        if (!this.customerSuppliedItems || this.customerSuppliedItems.length === 0) {
            return yPos;
        }

        const pageWidth = 215.9;
        const margin = 10;

        this.customerSuppliedItems.forEach(item => {
            if (yPos > 250) {
                pdf.addPage();
                yPos = 20;
            }

            const styleNumber = item.StyleNumber || 'DECG';
            const description = item.ProductName || 'Customer-Supplied Item';
            const qty = parseInt(item.Quantity) || 0;
            const unitPrice = item.FinalUnitPrice || item.BaseUnitPrice || 0;
            const lineTotal = item.LineTotal || (qty * unitPrice);

            // Light background for service rows
            pdf.setFillColor(255, 251, 235);
            pdf.rect(margin, yPos - 3.5, pageWidth - margin * 2, 6, 'F');

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(146, 64, 14);
            pdf.text(styleNumber, colX.style, yPos);

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(51, 51, 51);
            pdf.text(description, colX.color, yPos);

            pdf.setFont('helvetica', 'bold');
            const csQtyW = colX.price - colX.qty;
            pdf.text(String(qty), colX.qty + csQtyW / 2, yPos, { align: 'center' });
            pdf.setFont('helvetica', 'normal');
            pdf.text(this.formatCurrency(unitPrice), colX.price, yPos);
            pdf.setTextColor(76, 179, 84);
            pdf.text(this.formatCurrency(lineTotal), colX.total, yPos);
            pdf.setTextColor(51, 51, 51);

            yPos += 6;
        });

        return yPos;
    }

    /**
     * Render fee line items in PDF (Additional Stitches, AL charges, Digitizing)
     * @returns {number} Updated yPos after rendering fee rows
     */
    renderPdfFeeRows(pdf, yPos, colX) {
        const pageWidth = 215.9;
        const margin = 10;

        // Check if any fees to render
        const garmentStitchCharge = parseFloat(this.quoteData?.GarmentStitchCharge) || 0;
        const capStitchCharge = parseFloat(this.quoteData?.CapStitchCharge) || 0;
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
        const ltmGarmentPdf = parseFloat(this.quoteData?.LTM_Garment) || 0;
        const ltmCapPdf = parseFloat(this.quoteData?.LTM_Cap) || 0;
        const discountPdf = parseFloat(this.quoteData?.Discount) || 0;

        // Check for 3D Puff / Laser Patch fee items (shipping shown in totals only)
        const hasPuffFee = this.items.some(i => i.EmbellishmentType === 'fee' && i.StyleNumber === '3D-EMB' && i.LineTotal > 0);
        const hasPatchFee = this.items.some(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'Laser Patch' && i.LineTotal > 0);

        const hasFees = garmentStitchCharge > 0 || capStitchCharge > 0 ||
                        alGarmentCharge > 0 || alCapCharge > 0 ||
                        garmentDigitizing > 0 || capDigitizing > 0 ||
                        artChargePdf > 0 || rushFeePdf > 0 ||
                        ltmGarmentPdf > 0 || ltmCapPdf > 0 || discountPdf > 0 ||
                        hasPuffFee || hasPatchFee;
        if (!hasFees) return yPos;

        // Add separator line before fees
        yPos += 2;
        pdf.setDrawColor(76, 179, 84);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;

        pdf.setFontSize(7);

        // CHANGED 2026-01-14: Split stitch charges by garment/cap per ShopWorks naming standard
        // AS-GARM = Additional Stitches in Garment Logo, AS-CAP = Additional Stitches in Cap Logo
        if (garmentStitchCharge > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'AS-GARM', 'Additional Stitches in Garment Logo', 1, garmentStitchCharge, garmentStitchCharge);
        }
        if (capStitchCharge > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'AS-CAP', 'Additional Stitches in Cap Logo', 1, capStitchCharge, capStitchCharge);
        }

        // 1. Additional Logo - Garments (ShopWorks SKU: AL-GARM)
        if (alGarmentCharge > 0 && garmentQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALGarmentUnitPrice) || (alGarmentCharge / garmentQty);
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'AL-GARM', 'Additional Logo - Garments', garmentQty, unitPrice, alGarmentCharge);
        }

        // 2. Cap Back Embroidery (ShopWorks SKU: CB)
        if (alCapCharge > 0 && capQty > 0) {
            const unitPrice = parseFloat(this.quoteData?.ALCapUnitPrice) || (alCapCharge / capQty);
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'CB', 'Cap Back Embroidery', capQty, unitPrice, alCapCharge);
        }

        // 3. Digitizing Setup Garments (ShopWorks SKU: DD)
        if (garmentDigitizing > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'DD', 'Digitizing Setup Garments', 1, garmentDigitizing, garmentDigitizing);
        }

        // 4. Cap Setup Fee - DD-CAP for embroidery, GRT-50 for laser-patch
        if (capDigitizing > 0) {
            const capEmbellishmentType = this.quoteData?.CapEmbellishmentType || 'embroidery';
            if (capEmbellishmentType === 'laser-patch') {
                yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'GRT-50', 'Laser Patch Setup', 1, capDigitizing, capDigitizing);
            } else {
                yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'DD-CAP', 'Digitizing Setup Cap', 1, capDigitizing, capDigitizing);
            }
        }

        // 4b. 3D Puff Embroidery Upcharge (from saved fee items)
        const puffFeeItemPdf = this.items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === '3D-EMB');
        if (puffFeeItemPdf && puffFeeItemPdf.LineTotal > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, '3D-EMB', '3D Puff Embroidery Upcharge',
                puffFeeItemPdf.Quantity, puffFeeItemPdf.FinalUnitPrice, puffFeeItemPdf.LineTotal);
        }

        // 4c. Laser Leatherette Patch Upcharge (from saved fee items)
        const patchFeeItemPdf = this.items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'Laser Patch');
        if (patchFeeItemPdf && patchFeeItemPdf.LineTotal > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'Laser Patch', 'Laser Leatherette Patch Upcharge',
                patchFeeItemPdf.Quantity, patchFeeItemPdf.FinalUnitPrice, patchFeeItemPdf.LineTotal);
        }

        // 5. Logo Mockup & Print Review (ShopWorks SKU: GRT-50)
        const artCharge = parseFloat(this.quoteData?.ArtCharge) || 0;
        if (artCharge > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'GRT-50', 'Logo Mockup & Print Review', 1, artCharge, artCharge);
        }

        // 6. Graphic Design Services (ShopWorks SKU: GRT-75) @ $75/hr
        const graphicDesignHours = parseFloat(this.quoteData?.GraphicDesignHours) || 0;
        const graphicDesignCharge = parseFloat(this.quoteData?.GraphicDesignCharge) || 0;
        if (graphicDesignCharge > 0) {
            const desc = graphicDesignHours > 0
                ? `Graphic design services (${graphicDesignHours} hrs @ $75)`
                : 'Graphic design services';
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'GRT-75', desc, graphicDesignHours || 1, 75, graphicDesignCharge);
        }

        // 7. Rush Fee (ShopWorks SKU: RUSH)
        const rushFee = parseFloat(this.quoteData?.RushFee) || 0;
        if (rushFee > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'RUSH', 'Rush Fee', 1, rushFee, rushFee);
        }

        // NOTE: Shipping fee shown in totals section only (not as fee line item)

        // NOTE: Sample Fee removed from UI per user request (2026-01-14)

        // 8. Less than minimum fee garments (ShopWorks SKU: LTM)
        // Display as flat fee (qty=1) per user request - not distributed per-piece
        const ltmGarment = parseFloat(this.quoteData?.LTM_Garment) || 0;
        if (ltmGarment > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'LTM', 'Less than minimum fee garments', 1, ltmGarment, ltmGarment);
        }

        // 9. Less than minimum fee Caps (ShopWorks SKU: LTM-CAP)
        // Display as flat fee (qty=1) per user request - not distributed per-piece
        const ltmCap = parseFloat(this.quoteData?.LTM_Cap) || 0;
        if (ltmCap > 0) {
            yPos = this.renderPdfFeeRow(pdf, yPos, colX, 'LTM-CAP', 'Less than minimum fee Caps', 1, ltmCap, ltmCap);
        }

        // 10. Discount (ShopWorks SKU: DISCOUNT)
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

        // Description (truncated to 40 chars for readability)
        pdf.setFont('helvetica', 'italic');
        const truncDesc = description.substring(0, 40);
        pdf.text(truncDesc, colX.color + 2, yPos);

        // Qty column only (no duplicate in XXXL)
        pdf.setFont('helvetica', 'bold');
        const feeQtyW = colX.price - colX.qty;
        pdf.text(String(qty), colX.qty + feeQtyW / 2, yPos, { align: 'center' });

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

        // Check for laser-patch cap orders (EMB prefix with laser-patch embellishment type)
        if (prefix === 'EMB' && this.quoteData?.CapEmbellishmentType === 'laser-patch') {
            return 'Laser Patch';
        }

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

    /**
     * Format Screen Print locations array to readable string
     * @param {Array} locations - Array of location codes like ['FF', 'FB']
     * @returns {string} Formatted location string
     */
    formatScreenPrintLocations(locations) {
        if (!locations || locations.length === 0) return null;
        return locations.map(loc => this.formatLocationCode(loc)).join(' + ');
    }

    /**
     * Convert location code to readable name
     * @param {string} code - Location code like 'FF', 'LC'
     * @returns {string} Human-readable location name
     */
    formatLocationCode(code) {
        const locationNames = {
            'LC': 'Left Chest',
            'RC': 'Right Chest',
            'FF': 'Full Front',
            'FB': 'Full Back',
            'JF': 'Jumbo Front',
            'JB': 'Jumbo Back',
            'CF': 'Center Front',
            'CB': 'Center Back',
            'LS': 'Left Sleeve',
            'RS': 'Right Sleeve',
            'BN': 'Back of Neck'
        };
        return locationNames[code] || code;
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

        // 4. Extra stitch charge (SEPARATE line item - added to total)
        console.group('4️⃣ Extra Stitches (SEPARATE LINE ITEM)');
        const addlStitch = parseFloat(q?.AdditionalStitchCharge) || 0;
        const stitchCount = parseFloat(q?.StitchCount) || 8000;
        console.log('Stitch Count:', stitchCount);
        console.log('Extra Stitch Amount:', addlStitch.toFixed(2));
        console.log('✅ Extra stitches are a SEPARATE line item (shown as ADDL-STITCH)');
        console.log('✅ This value IS added to the total');
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
        // Note: For quotes saved after 2026-02-06, LTM is baked into SubtotalAmount
        // and LTM_Garment/LTM_Cap are 0, so ltmFee from LTMFeeTotal would double-count.
        // Use LTM_Garment + LTM_Cap (the display values) instead of LTMFeeTotal for the formula.
        console.group('7️⃣ VERIFICATION');
        const displayLtm = (parseFloat(q?.LTM_Garment) || 0) + (parseFloat(q?.LTM_Cap) || 0);
        const expectedTotal = subtotal + displayLtm + totalSetup + totalAL + artCharge + rushFee + sampleFee - discount;
        console.log('Formula: subtotal + LTM(display) + setup + AL + art + rush + sample - discount');
        console.log(`         ${subtotal.toFixed(2)} + ${displayLtm.toFixed(2)} + ${totalSetup.toFixed(2)} + ${totalAL.toFixed(2)} + ${artCharge.toFixed(2)} + ${rushFee.toFixed(2)} + ${sampleFee.toFixed(2)} - ${discount.toFixed(2)}`);
        console.log('Expected Total:', expectedTotal.toFixed(2));
        console.log('Actual TotalAmount:', totalAmount.toFixed(2));
        const diff = Math.abs(expectedTotal - totalAmount);
        if (diff < 0.01) {
            console.log('✅ PASS: Totals match!');
        } else {
            console.log('❌ FAIL: Difference of $' + diff.toFixed(2));
        }
        console.groupEnd();

        // 8. Shipping
        console.group('8️⃣ Shipping');
        const shippingFee = this.getShippingFee();
        console.log('Shipping Fee (SHIP item):', shippingFee.toFixed(2));
        console.groupEnd();

        // 9. Tax calculation (shipping is taxable in WA state)
        console.group('9️⃣ Tax & Grand Total');
        const taxRate = this.taxRate ?? 0.101;
        const taxableAmount = totalAmount + shippingFee;
        const tax = Math.round(taxableAmount * taxRate * 100) / 100;
        const grandTotalWithTax = taxableAmount + tax;
        console.log('Tax Rate:', (taxRate * 100).toFixed(1) + '%');
        console.log('Taxable Amount (subtotal + shipping):', taxableAmount.toFixed(2));
        console.log('Tax Amount:', tax.toFixed(2));
        console.log('Shipping:', shippingFee.toFixed(2));
        console.log('Grand Total (subtotal + shipping + tax):', grandTotalWithTax.toFixed(2));
        console.groupEnd();

        console.groupEnd(); // End main group
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new QuoteViewPage();
});
