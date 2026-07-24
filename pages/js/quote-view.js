/**
 * Quote View Page JavaScript
 * Professional customer-facing quote display with size matrix and sales tax
 * Matches PDF invoice format from EmbroideryInvoiceGenerator
 */

// Debug logging gate — customer-facing page, so console.log output (including the
// pricing-internals audit dump) only prints on localhost. console.error/warn stay live.
const QV_DEBUG = window.location.hostname === 'localhost';

// Inline-SVG product placeholder (neutral gray garment glyph). The old
// /pages/images/product-placeholder.png never existed in the repo, so every
// fallback 404'd into a broken-image icon. A data URI can't go missing.
const QV_PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23f3f4f6'/%3E%3Cpath d='M22 14l-12 8 5 9 5-3v22h24V28l5 3 5-9-12-8a10 10 0 0 1-20 0z' fill='%23d1d5db'/%3E%3C/svg%3E";

class QuoteViewPage {
    constructor() {
        this.quoteId = null;
        this.quoteData = null;
        this.items = [];
        this.productItems = [];
        this.customerSuppliedItems = [];
        this.taxRate = 0.102; // 10.2% Milton WA default (DOR, updated 2026-07-06) — overridden by the quote's frozen TaxRate / TAX fee item when present
        this.includeTax = true;

        // Quote type mapping
        this.quoteTypes = {
            'DTG': 'Direct-to-Garment',
            'DTF': 'Direct-to-Film',
            'EMB': 'Embroidery',
            'EMBC': 'Customer Supplied Embroidery',
            'CEMB': 'Contract Embroidery', // Phase 6: fallback when CEMB quote has no items
            'SPC': 'Screen Print',
            'SP': 'Screen Print',
            'RICH': 'Richardson Caps',
            'CAP': 'Cap Embroidery',
            'LT': 'Laser Tumblers',
            'PATCH': 'Embroidered Emblems',
            'STK': 'Die-Cut Stickers & Vinyl Banners',
            'OF':  'Order Form',  // A4 (2026-05-22): OF-NNNN was falling through to "Custom Quote"
            'WQ':  'Web Quote Request'  // Phase 3 customer quote-cart (2026-06-11)
        };

        // Method subhead labels for MIXED-method quotes (WQ web-cart quotes can
        // carry several EmbellishmentTypes; staff quotes are single-method so
        // these subheads never render for existing prefixes).
        this.methodLabels = {
            'embroidery': 'Embroidery',
            'cap': 'Cap Embroidery',
            'dtg': 'DTG Print',
            'screenprint': 'Screen Print',
            'dtf': 'DTF Transfer'
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

        // NOTE (2026-07-06): The hardcoded extended-size upcharge map
        // ({2XL:2,3XL:4,…}) and the legacy product-card renderer that consumed
        // it were REMOVED here. Quote-view is a FROZEN-quote DISPLAY surface: it
        // must render the per-line prices the engine already saved, never invent
        // upcharges from a front-end constant (CLAUDE.md Rule 9 — "3 price
        // surfaces = ONE engine; never add a 4th pricing path or a hardcoded
        // price"). The live path (renderItems → buildProductRows → renderProductRow)
        // already reads BaseUnitPrice/FinalUnitPrice/LineTotal off the saved
        // quote_items and derives any upcharge as (extended price − base price),
        // matching embroidery-quote-invoice.js. Upcharge authority upstream is the
        // API bundle's sellingPriceDisplayAddOns (quote-cart-engine.js:915,926 —
        // which HARD-ERRORS rather than falling back to a hardcoded map).

        // Cache for product images
        this.imageCache = {};

        // API base URL for product details
        this.apiBaseUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        this.init();
    }

    async init() {
        // Get quote ID from URL
        this.quoteId = this.getQuoteIdFromUrl();

        // URL query params — used below for ?deposit=success|canceled (deposit
        // panel banner) and ?autoPdf=1. Declared here after a prior commit
        // (a6ae37d1, 2026-07-04) removed the original declaration while closing
        // the ?staff=true hole, leaving bare `urlParams` refs that threw a
        // ReferenceError and aborted init() on every loaded quote. (fix 2026-07-06)
        const urlParams = new URLSearchParams(window.location.search);

        if (!this.quoteId) {
            this.showError('Invalid quote URL');
            return;
        }

        // Set current year in footer
        document.getElementById('current-year').textContent = new Date().getFullYear();

        // Staff mode is driven ONLY by a real logged-in staff session — never a URL
        // param. `?staff=true` previously let anyone reveal the staff-only controls
        // (ShopWorks sync, push internals) on a customer's quote with no auth.
        this.isStaff = (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.isLoggedIn());

        // Load quote data
        await this.loadQuote();

        // Customer-view beacon (2026-06-10): record that the customer opened this
        // quote so reps see "Viewed" on it. Staff browsers are excluded two ways:
        // the isStaff session check AND the nwca_staff localStorage flag (set by
        // every quote builder). Telemetry only — failures stay in console.
        try {
            let staffBrowser = false;
            try { staffBrowser = !!localStorage.getItem('nwca_staff'); } catch (_) {}
            if (this.quoteData && !this.isStaff && !staffBrowser) {
                fetch(`${this.apiBaseUrl}/api/quote_analytics`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        SessionID: 'qv_' + Math.random().toString(36).slice(2, 11),
                        EventType: 'customer_view',
                        QuoteID: this.quoteId
                    })
                }).catch(err => console.warn('[quote-view] view beacon failed:', err));
            }
        } catch (_) { /* never block rendering on telemetry */ }

        // Setup event listeners
        this.setupEventListeners();

        // Wire the "Open as Invoice" link to the matching /invoice/:quoteId URL.
        const invLink = document.getElementById('open-invoice-link');
        if (invLink && this.quoteId) {
            invLink.href = `/invoice/${encodeURIComponent(this.quoteId)}`;
        }

        // ShopWorks sync strip (Erik 2026-05-21).
        // Renders the "Pending import" / "ShopWorks #N" pill + Refresh button.
        // Auto-syncs in the background if data is > 30 min stale.
        this.setupShopWorksSyncStrip();

        // Quick action buttons (Print / Copy link / Email customer)
        this._setupQuickActions();

        // Quote Timeline (#15, 2026-07-05): collapsible event history built from
        // data already loaded (created / accepted) + a staff-only customer_view
        // analytics fetch. Push/ShopWorks events re-render via applyShopWorksOverlay.
        this._initTimeline();

        // Setup push-to-ShopWorks button (staff only; EMB + SCP/SP + DTF).
        // Expert audit 2026-07-07: the acceptance email lands staff on THIS page,
        // but only EMB could push from here — SCP/DTF staff had to round-trip
        // through the builder (?edit=), where acceptance isn't even visible.
        if (this.isStaff && this.quoteId && this._pushRoute()) {
            this.setupPushButton();
        }

        // Online deposit (Storefront Checkout Phase 1, 2026-07-05): customer
        // "Pay deposit" panel + staff enable-deposit strip. Reads the deposit
        // block + payments[] the server keeps in Notes JSON.
        this.setupDepositUI(urlParams);

        // Phase 10 (+ Phase 11 update): if ?autoPdf=1 is in the URL,
        // trigger the print-to-PDF dialog automatically after a short
        // delay (lets the DOM finish painting + product images settle).
        // Chrome opens its print preview; Ruthie clicks "Save as PDF".
        if (urlParams.get('autoPdf') === '1' && this.quoteData) {
            setTimeout(() => {
                try {
                    window.print();
                } catch (err) {
                    console.warn('[quote-view] autoPdf window.print() failed:', err);
                }
            }, 800);
        }
    }

    getQuoteIdFromUrl() {
        const path = window.location.pathname;
        // Match multiple formats: DTF0112-1 or DTF-1768263686415
        const match = path.match(/\/quote\/([A-Z]{2,5}[-\d]+)/);
        if (match) return match[1];
        // Phase 10.1 (2026-05-14): defense-in-depth fallback for
        // /pages/quote-view.html?quoteId=<ID> URLs (any old email
        // links from before the /quote/<ID> path was canonical).
        try {
            const params = new URLSearchParams(window.location.search);
            const qid = params.get('quoteId');
            if (qid && /^[A-Z]{2,5}[-\d]+-?\d*$/.test(qid)) return qid;
        } catch (e) { /* ignore */ }
        return null;
    }

    /**
     * Share-link token suffix for API calls (2026-07-24).
     *
     * Quotes saved from now on carry an unguessable token; their share links
     * look like /quote/STK-2026-001?k=<token>. Quotes saved BEFORE this have no
     * stored token and the server serves them without one, so an old link with
     * no `?k=` keeps working — this returns '' in that case and nothing breaks.
     * Staff sessions bypass the check server-side.
     */
    shareTokenParam(joiner) {
        try {
            const k = new URLSearchParams(window.location.search).get('k');
            if (!k) return '';
            return (joiner || '?') + 'k=' + encodeURIComponent(k);
        } catch (e) { return ''; }
    }

    async loadQuote() {
        try {
            const response = await fetch(`/api/public/quote/${this.quoteId}${this.shareTokenParam()}`);

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

            if (QV_DEBUG) {
                console.log('[QuoteView] Loaded quote data:', this.quoteData);
                console.log('[QuoteView] Loaded items:', this.items);
            }

            // Read tax rate: prefer frozen TaxRate column, then TAX fee item, then default 10.2%
            // Normalize percent-vs-decimal: EMB stores TaxRate as a DECIMAL (0.101) but
            // SCP/DTF store it as a PERCENT (10.1). Without this, an SCP/DTF quote rendered
            // tax at ~1010% on the report/invoice. (2026-06-01)
            if (this.quoteData.TaxRate != null && this.quoteData.TaxRate !== '') {
                const rawTaxRate = parseFloat(this.quoteData.TaxRate) || 0;
                this.taxRate = rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate;
                this.includeTax = this.taxRate > 0;
            } else {
                const taxFeeItem = this.items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'TAX');
                if (taxFeeItem) {
                    this.taxRate = taxFeeItem.BaseUnitPrice / 100;
                    this.includeTax = this.taxRate > 0;
                }
            }

            // Debug charge verification (2026-01-14) — pricing-internals dump,
            // localhost only so it never prints in a customer's console.
            if (QV_DEBUG) {
                this.debugChargeVerification();
            }

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

        // Phase 8 (2026-05-14): CEMB quotes get a layout swap —
        //   - Billing address renders UNDER the customer info in the
        //     Prepared For (left) card via the billing-block div.
        //   - The middle card becomes "Ship To" again (Phase 6 relabel
        //     reverted) and reads from ShippingAddress/* (not ShipTo*).
        // For non-CEMB quotes, behavior is unchanged: middle card shows
        // ShipTo* with the default "Ship To" heading.
        const isCEMB_phase8 = (this.quoteId || '').startsWith('CEMB');

        if (isCEMB_phase8) {
            // Render billing-block inside Prepared For card
            const billAddr = this.quoteData.ShipToAddress || '';
            const billCity = this.quoteData.ShipToCity || '';
            const billState = this.quoteData.ShipToState || '';
            const billZip = this.quoteData.ShipToZip || '';
            if (billAddr || billCity) {
                const billBlock = document.getElementById('customer-billing-block');
                if (billBlock) {
                    document.getElementById('customer-billing-address').textContent = billAddr;
                    const billCityLine = [billCity, billState].filter(Boolean).join(', ') + (billZip ? ' ' + billZip : '');
                    document.getElementById('customer-billing-city-state').textContent = billCityLine;
                    billBlock.style.display = 'block';
                }
            }
        }

        // Middle "Ship To" card data source:
        //   - CEMB: ShippingAddress/* (the actual shipping destination
        //     captured during the pre-flight). May be empty when "same
        //     as billing" or "customer pickup" — handle below.
        //   - Non-CEMB: ShipToAddress/* (legacy behavior).
        const shipAddrField  = isCEMB_phase8 ? 'ShippingAddress' : 'ShipToAddress';
        const shipCityField  = isCEMB_phase8 ? 'ShippingCity'    : 'ShipToCity';
        const shipStateField = isCEMB_phase8 ? 'ShippingState'   : 'ShipToState';
        const shipZipField   = isCEMB_phase8 ? 'ShippingZip'     : 'ShipToZip';
        const shipToAddress = this.quoteData[shipAddrField] || '';
        const shipToCity    = this.quoteData[shipCityField]  || '';
        const shipToState   = this.quoteData[shipStateField] || '';
        const shipToZip     = this.quoteData[shipZipField]   || '';
        const shipMethod = this.quoteData.ShipMethod || '';
        const hasTracking = this.quoteData.Carrier || this.quoteData.TrackingNumber;

        // CEMB pickup / same-as-billing edge cases (Phase 8):
        //   - ShipMethod === 'Customer Pickup' → show "Customer Pickup"
        //   - No shipping address but ShipMethod set → "Same as billing"
        const isCEMBPickup        = isCEMB_phase8 && shipMethod === 'Customer Pickup';
        const isCEMBSameAsBilling = isCEMB_phase8 && !shipToAddress && !shipToCity
            && shipMethod && shipMethod !== 'Customer Pickup';

        if (shipToAddress || shipToCity || shipMethod || hasTracking || isCEMBPickup || isCEMBSameAsBilling) {
            const shipCard = document.getElementById('ship-to-card');
            if (shipCard) {
                if (isCEMBPickup) {
                    // Show only "Customer Pickup" italic — no address, no Via row
                    document.getElementById('ship-to-address').innerHTML =
                        '<em style="color: #64748b;">Customer Pickup</em>';
                    document.getElementById('ship-to-city-state').textContent = '';
                    // Method row stays empty (the "Customer Pickup" line already conveys it)
                } else if (isCEMBSameAsBilling) {
                    document.getElementById('ship-to-address').innerHTML =
                        '<em style="color: #64748b;">Same as billing</em>';
                    document.getElementById('ship-to-city-state').textContent = '';
                    document.getElementById('ship-to-method').textContent = 'Via: ' + shipMethod;
                } else {
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
                }

                // Tracking info (supports comma-separated multiple tracking numbers)
                const carrier = this.quoteData.Carrier || '';
                const trackingNum = this.quoteData.TrackingNumber || '';
                if (carrier || trackingNum) {
                    const trackingEl = document.getElementById('ship-to-tracking');
                    if (trackingEl) {
                        const carriers = carrier.split(',').map(s => s.trim());
                        const trackingNums = trackingNum.split(',').map(s => s.trim());
                        const fragments = trackingNums.map((tn, i) => {
                            if (!tn) return '';
                            const c = carriers[i] || carriers[0] || '';
                            const link = this.getTrackingLink(c, tn);
                            const carrierLabel = c ? ' (' + this.escapeHtml(c) + ')' : '';
                            if (link) {
                                return `<a href="${this.escapeHtml(link)}" target="_blank" rel="noopener" style="color:#4f46e5; text-decoration:underline;">${this.escapeHtml(tn)}</a>${carrierLabel}`;
                            }
                            return `${this.escapeHtml(tn)}${carrierLabel}`;
                        }).filter(f => f);
                        if (fragments.length) {
                            trackingEl.innerHTML = 'Tracking: ' + fragments.join('<br>Tracking: ');
                            trackingEl.style.display = 'block';
                        }
                    }
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

        // Customer Artwork & Mockups (Custom T-Shirts storefront orders)
        this.renderCustomerArtwork();

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

        // Header is shared with the Screen Print path — set it explicitly so it's
        // always correct regardless of render order. (2026-06-01)
        const specsTitle = specsSection.querySelector('h2');
        if (specsTitle) specsTitle.textContent = 'Transfer Specifications';

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

        // Method-aware header — this element is shared with the DTF specs
        // section (hardcoded "Transfer Specifications" in the HTML). Relabel it
        // for Screen Print so the report isn't mislabeled. (2026-06-01)
        const specsTitle = specsSection.querySelector('h2');
        if (specsTitle) specsTitle.textContent = 'Screen Print Specifications';

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
        const section = document.getElementById('special-notes-section');
        const content = document.getElementById('special-notes-content');
        if (!section || !content) return;

        if (raw) {
            let designs;
            try { designs = JSON.parse(raw); } catch (e) { /* ignore */ }
            if (Array.isArray(designs) && designs.length > 0) {
                const designHtml = designs.map(d => this.escapeHtml(d)).join('<br>');
                const block = document.createElement('div');
                block.style.marginTop = '12px';
                block.innerHTML = `<strong>Design References:</strong><br>${designHtml}`;
                content.appendChild(block);
                section.style.display = 'block';
            }
        }

        // Digitizing Codes (comma-separated string, e.g., "DD,DGT-002")
        const digCodes = this.quoteData?.DigitizingCodes;
        if (digCodes) {
            const block = document.createElement('div');
            block.style.marginTop = '8px';
            block.innerHTML = `<strong>Digitizing:</strong> ${this.escapeHtml(digCodes)}`;
            content.appendChild(block);
            section.style.display = 'block';
        }

        // Order Notes (from ShopWorks Note section)
        const orderNotes = this.quoteData?.OrderNotes;
        if (orderNotes) {
            const block = document.createElement('div');
            block.style.cssText = 'margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb;';
            block.innerHTML = `<strong>Order Notes:</strong><br>${this.escapeHtml(orderNotes).replace(/\n/g, '<br>')}`;
            content.appendChild(block);
            section.style.display = 'block';
        }
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

            if (QV_DEBUG) {
                console.log(`[QuoteView] Fetched image for ${styleNumber} ${colorName}: ${imageUrl ? 'Found' : 'Not found'}${match ? ` (matched: ${match.COLOR_NAME})` : ''}`);
            }
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

        // Garment size columns are meaningless on quotes for products that have
        // no apparel sizes — stickers, banners and emblem patches. Rendering them
        // gave a sticker line six empty cells and made the quote look broken
        // (2026-07-24). Suppress the whole size block for those prefixes and let
        // Item/Color/Qty/Unit/Total carry the row.
        const sizelessPrefix = ['STK', 'PATCH'].includes(this.quoteId?.split(/[\d-]/)[0] || '');
        this.hideSizeColumns = sizelessPrefix;

        const sizeHeaders = sizelessPrefix ? '' : `
                            <th class="size-col">S</th>
                            <th class="size-col">M</th>
                            <th class="size-col">L</th>
                            <th class="size-col">XL</th>
                            <th class="size-col">2XL</th>
                            <th class="size-col">3XL</th>`;

        // Build compact table HTML (no Description column)
        html += `
            <div class="product-table-wrapper">
                <table class="product-table compact">
                    <thead>
                        <tr>
                            <th class="style-col">Item / Description</th>
                            <th class="color-col">Color</th>${sizeHeaders}
                            <th class="qty-col">Qty</th>
                            <th class="price-col">Unit $</th>
                            <th class="total-col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Render rows for each product group.
        // MIXED-method quotes (WQ web-cart): emit a method subhead row whenever
        // the EmbellishmentType changes between product groups. Single-method
        // quotes (every staff prefix) have one type, so nothing changes for them.
        const distinctMethods = [...new Set(this.productItems.map(i => String(i.EmbellishmentType || '').toLowerCase()))];
        const isMixedMethods = distinctMethods.length > 1;
        let lastMethodSubhead = null;
        let rowIndex = 0;
        groups.forEach((group, groupIndex) => {
            if (isMixedMethods) {
                const m = String(group.embellishmentType || '').toLowerCase();
                if (m !== lastMethodSubhead) {
                    const label = this.methodLabels[m] || (m ? m.toUpperCase() : 'Other');
                    const locSuffix = group.printLocation ? ` — ${group.printLocation}` : '';
                    // colspan must track the header — 11 columns normally, 5 when
                    // the six garment size columns are suppressed (STK/PATCH).
                    html += `<tr class="method-subhead"><td colspan="${this.hideSizeColumns ? 5 : 11}">${this.escapeHtml(label + locSuffix)}</td></tr>`;
                    lastMethodSubhead = m;
                }
            }
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

        // Mixed-method WQ (web-cart) quotes: a single "Location:" header would
        // show only the FIRST item's location and mislead — the per-method
        // subhead rows in the items table carry method + location instead.
        if (prefix === 'WQ') {
            const types = new Set((this.productItems || []).map(i => String(i.EmbellishmentType || '').toLowerCase()));
            if (types.size > 1) return '';
        }
        // Stickers / banners / emblem patches have no decoration LOCATION at all —
        // they are the product, not something applied to a garment. Without this
        // the block fell through to the `location || 'Left Chest'` default at the
        // bottom and told sticker customers their stickers go on the left chest
        // (2026-07-24).
        if (['STK', 'PATCH'].includes(prefix)) return '';

        // CEMB (Contract Embroidery, AI-drafted) added 2026-05-14 (Phase 5)
        // so the Location + Stitches detail row renders on CEMB quote views.
        const isEmbroideryQuote = ['EMB', 'EMBC', 'CEMB', 'RICH', 'CAP'].includes(prefix);

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
            // Design number assignments (2026-02-19) + thumbnails (2026-02-23)
            const garmentDesign = this.quoteData?.GarmentDesignNumber;
            const capDesign = this.quoteData?.CapDesignNumber;
            if (garmentDesign) {
                html += `<div class="emb-detail" style="display:flex;align-items:center;gap:8px;">
                    <span id="qv-garment-thumb" style="display:none;"></span>
                    <span><span class="emb-label">Garment Design:</span> <span class="emb-value">#${this.escapeHtml(garmentDesign)}</span></span>
                </div>`;
            }
            if (capDesign && capDesign !== garmentDesign) {
                html += `<div class="emb-detail" style="display:flex;align-items:center;gap:8px;">
                    <span id="qv-cap-thumb" style="display:none;"></span>
                    <span><span class="emb-label">Cap Design:</span> <span class="emb-value">#${this.escapeHtml(capDesign)}</span></span>
                </div>`;
            }
            // Fetch design thumbnails for quote view (non-blocking)
            if (garmentDesign || capDesign) {
                this._loadQuoteViewThumbnails(garmentDesign, capDesign);
            }

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

        // Style → display label + SKU map.
        //
        // Phase 5 (2026-05-14): extended from old binary {DECC: Caps, else:
        // Garments} to include DECG-FB + CTR-Cap/CTR-Garmt/CTR-FB.
        //
        // Phase 6 (2026-05-14): added explicit `sku` field — the style col
        // now renders as a 2-line stack matching the calculator's segmented
        // picker design (friendly label on top, part number subtitle below).
        // CEMB labels simplified from "Contract X" to just "X" since the
        // SKU subtitle (CTR-*) carries the wholesale-vs-retail distinction.
        // Phase 7 (2026-05-15): Contract DTG SKUs added so each saved
        // line item (one per print location + heavyweight + LTM) reads
        // with its own clear label instead of the generic
        // "Customer-Supplied Item" fallback. DTG-HW and LTM carry
        // isFee:true so the renderer tints them slate instead of amber,
        // signaling "this is a fee, not a print location" at a glance.
        const STYLE_LABEL_MAP = {
            'DECC':      { label: 'Customer Caps',      sku: 'DECC',      isCap: true  },
            'DECG':      { label: 'Customer Garments',  sku: 'DECG',      isCap: false },
            'DECG-FB':   { label: 'Full Back',          sku: 'DECG-FB',   isCap: false },
            'CTR-Cap':   { label: 'Cap',                sku: 'CTR-Cap',   isCap: true  },
            'CTR-Garmt': { label: 'Garment',            sku: 'CTR-Garmt', isCap: false },
            'CTR-FB':    { label: 'Full Back',          sku: 'CTR-FB',    isCap: false }, // legacy back-compat
            'DTG-LC':    { label: 'Left Chest',         sku: 'DTG-LC',    isCap: false },
            'DTG-FF':    { label: 'Full Front',         sku: 'DTG-FF',    isCap: false },
            'DTG-FB':    { label: 'Full Back',          sku: 'DTG-FB',    isCap: false },
            'DTG-JF':    { label: 'Jumbo Front',        sku: 'DTG-JF',    isCap: false },
            'DTG-JB':    { label: 'Jumbo Back',         sku: 'DTG-JB',    isCap: false },
            'DTG-HW':    { label: 'Heavyweight Upcharge', sku: 'DTG-HW', isCap: false, isFee: true },
            'LTM':       { label: 'Less-Than-Minimum Fee', sku: 'LTM',   isCap: false, isFee: true },
        };

        // Set of SKUs that represent a DTG print location — used to swap
        // the size-col placeholder text from "Customer-supplied" to
        // "DTG print", and to strip the redundant location prefix from
        // the ProductName when it matches the label.
        const DTG_LOCATION_SKUS = new Set(['DTG-LC', 'DTG-FF', 'DTG-FB', 'DTG-JF', 'DTG-JB']);

        let html = '';
        this.customerSuppliedItems.forEach(item => {
            const styleNumber = item.StyleNumber || 'DECG';
            let description = item.ProductName || 'Customer-Supplied Item';
            const qty = parseInt(item.Quantity) || 0;
            const unitPrice = item.FinalUnitPrice || item.BaseUnitPrice || 0;
            const lineTotal = item.LineTotal || (qty * unitPrice);
            const styleMeta = STYLE_LABEL_MAP[styleNumber] || { label: 'Customer-Supplied Item', sku: styleNumber, isCap: false };
            const displayLabel = styleMeta.label;
            const displaySku = styleMeta.sku;
            const isCap = styleMeta.isCap;
            const isFee = !!styleMeta.isFee;
            // Tints: slate for fees (HW, LTM), blue for caps, amber for garments/back
            const bg     = isFee ? '#f1f5f9' : (isCap ? '#eff6ff' : '#fffbeb');
            const ink    = isFee ? '#334155' : (isCap ? '#1e40af' : '#92400e');
            const subInk = isFee ? '#64748b' : (isCap ? '#3b82f6' : '#b45309');

            // Trim redundant location prefix on DTG location rows:
            // "Left Chest DTG print" → "DTG print" once the label column
            // already shows "Left Chest".
            if (DTG_LOCATION_SKUS.has(styleNumber) && description.startsWith(displayLabel + ' ')) {
                description = description.slice(displayLabel.length + 1);
            }

            // Size-col placeholder text varies by category so HW/LTM
            // don't read as "customer-supplied items" (which they aren't).
            let sizeColPlaceholder = 'Customer-supplied';
            if (styleNumber === 'DTG-HW') sizeColPlaceholder = 'Per-piece upcharge';
            else if (styleNumber === 'LTM') sizeColPlaceholder = 'Order-level fee';
            else if (DTG_LOCATION_SKUS.has(styleNumber)) sizeColPlaceholder = 'DTG print';

            html += `
                <tr class="customer-supplied-row" style="background: ${bg};">
                    <td class="style-col" style="font-weight: 600; color: ${ink};">
                        <div>${this.escapeHtml(displayLabel)}</div>
                        <div style="font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10px; font-weight: 500; color: ${subInk}; opacity: 0.75; margin-top: 2px; letter-spacing: 0.03em;">${this.escapeHtml(displaySku)}</div>
                    </td>
                    <td class="color-col" style="font-size: 11px;">${this.escapeHtml(description)}</td>
                    ${this.hideSizeColumns ? '' : `<td class="size-col" colspan="6" style="text-align: center; color: #94a3b8; font-size: 10px; font-style: italic;">
                        ${this.escapeHtml(sizeColPlaceholder)}
                    </td>`}
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

        // 6. Graphic Design Services - ShopWorks SKU: GRT-75
        // Rate derived from the SAVED charge/hours — never a literal $75. The quote
        // page must show what was saved with the quote, not today's Caspio rate.
        const graphicDesignHours = parseFloat(this.quoteData?.GraphicDesignHours) || 0;
        const graphicDesignCharge = parseFloat(this.quoteData?.GraphicDesignCharge) || 0;
        if (graphicDesignCharge > 0) {
            const graphicDesignRate = graphicDesignHours > 0
                ? graphicDesignCharge / graphicDesignHours
                : graphicDesignCharge;
            const desc = graphicDesignHours > 0
                ? `Graphic design services (${graphicDesignHours} hrs @ ${this.formatCurrency(graphicDesignRate)}/hr)`
                : 'Graphic design services';
            html += this.renderFeeRow('GRT-75', desc, graphicDesignHours || 1, graphicDesignRate, graphicDesignCharge);
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

        // 11. Catch-all: render every fee LINE ITEM that wasn't already rendered from a
        //     Quote_Sessions column above. The redesigned builder saves bar services (AL,
        //     AL-CAP, DECG-FB, DD, GRT-50, GRT-75, Monogram, RUSH, …) as fee line items with
        //     the session columns left at 0 — so the OLD static "handled" block SILENTLY
        //     DROPPED them and the invoice didn't foot (Erik's #1 rule). Now a code is
        //     suppressed ONLY when its session-column emitter actually fired (legacy quotes),
        //     so each charge renders exactly once whether it came from a column or a line
        //     item. 3D-EMB/Laser Patch render from items via their own emitters above;
        //     TAX/SHIP are order-level (totals). (2026-06-04 audit)
        const handledFeeStyleNumbers = new Set(['3D-EMB', 'Laser Patch', 'TAX', 'SHIP', 'SHIPPING']);
        const suppressIf = (cond, ...codes) => { if (cond) codes.forEach(c => handledFeeStyleNumbers.add(c)); };
        suppressIf(garmentStitchCharge > 0, 'AS-GARM', 'AS-Garm');
        suppressIf(capStitchCharge > 0, 'AS-CAP');
        suppressIf(alGarmentCharge > 0 && garmentQty > 0, 'AL', 'AL-GARM');
        suppressIf(alCapCharge > 0 && capQty > 0, 'AL-CAP', 'CB');
        suppressIf(garmentDigitizing > 0, 'DD');
        // Cap digitizing also suppresses 'DD': the save path stores the cap fee item
        // with StyleNumber 'DD' (embroidery-quote-service "Digitizing - Caps"), so a
        // cap-only quote (garmentDigitizing=0) would otherwise render it twice.
        suppressIf(capDigitizing > 0, 'DD-CAP', 'GRT-50', 'DD');
        suppressIf(artCharge > 0, 'GRT-50');
        suppressIf(graphicDesignCharge > 0, 'GRT-75');
        suppressIf(rushFee > 0, 'RUSH');
        suppressIf(ltmGarment > 0, 'LTM');
        suppressIf(ltmCap > 0, 'LTM-CAP');
        suppressIf(discount > 0, 'DISCOUNT');
        const unhandledFees = (this.items || []).filter(i =>
            i.EmbellishmentType === 'fee' &&
            !handledFeeStyleNumbers.has(i.StyleNumber) &&
            Number(i.LineTotal) !== 0
        );
        for (const fee of unhandledFees) {
            const desc = fee.ProductName || fee.StyleNumber || 'Service Fee';
            // Raw values here — renderFeeRow() escapes both partNum and description
            // (escaping twice rendered '&' as '&amp;amp;').
            html += this.renderFeeRow(
                fee.StyleNumber || '',
                desc,
                fee.Quantity || 1,
                fee.FinalUnitPrice || fee.BaseUnitPrice || 0,
                fee.LineTotal || 0
            );
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
                ${this.hideSizeColumns ? '' : `<td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col"></td>
                <td class="size-col"></td>`}
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

        modalImage.src = group.imageUrl || QV_PLACEHOLDER_IMG;
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

        // SIZELESS PRODUCTS (2026-07-24). Every row below is derived from
        // SizeBreakdown, so a product with no garment sizes — stickers, banners,
        // emblem patches — produced ZERO rows and vanished from the quote
        // entirely, while its money still counted toward the total. A customer
        // saw a $346 total with only the $50 setup fee itemised.
        //
        // Keyed on "the breakdown yielded nothing", not on a prefix, so it also
        // catches any future sizeless product. Apparel always has a breakdown,
        // so this can never fire for a garment.
        if (Object.keys(allSizes).length === 0) {
            const totalQty = productGroup.items.reduce((s, i) => s + (Number(i.Quantity) || 0), 0);
            const totalAmt = productGroup.items.reduce((s, i) => s + (Number(i.LineTotal) || 0), 0);
            if (totalQty > 0 || totalAmt > 0) {
                rows.push({
                    style: productGroup.styleNumber,
                    description: productGroup.productName,
                    color: productGroup.color,
                    sizes: {},
                    qty: totalQty,
                    unitPrice: totalQty > 0 ? totalAmt / totalQty : 0,
                    lineTotal: totalAmt,
                    isFirstRow: true,
                    groupIndex: groupIndex
                });
            }
            return rows;
        }

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

                // Determine style suffix — ShopWorks uses _2X (not _2XL) for 2XL
                const SUFFIX_OVERRIDES = { '2XL': '_2X' };
                const suffix = SUFFIX_OVERRIDES[size] || `_${size}`;

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
        // XXXL column is the catch-all (Size06): any size without a dedicated column
        // (3XL+, tall, youth, toddler, big, OSFA/OSFM, combos, …). buildProductRows
        // emits one row per extended size, so a generic lookup covers every size it
        // can emit — the old hardcoded || chain missed youth/toddler/7XL+/OSFM and
        // left the size cells blank.
        const dedicatedSizeCols = ['S', 'M', 'L', 'XL', '2XL'];
        const catchAllSize = Object.keys(row.sizes).find(s => !dedicatedSizeCols.includes(s));
        const xxxlCol = (catchAllSize && row.sizes[catchAllSize]) || '';

        // Style column with clickable image for first row (opens modal)
        let styleCell;
        if (isFirstRow) {
            styleCell = `
                <td class="style-col clickable" onclick="window.quoteViewPage.openProductModal(${groupIndex})">
                    <div class="style-with-image">
                        <img id="product-image-${groupIndex}" class="product-thumb" src="${QV_PLACEHOLDER_IMG}" alt="${this.escapeHtml(row.style)}">
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
                ${this.hideSizeColumns ? '' : `<td class="size-col">${sCol}</td>
                <td class="size-col">${mCol}</td>
                <td class="size-col">${lgCol}</td>
                <td class="size-col">${xlCol}</td>
                <td class="size-col">${xxlCol}</td>
                <td class="size-col">${xxxlCol}</td>`}
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
                if (QV_DEBUG) {
                    console.log(`[QuoteView] Deduped ${group.styleNumber} ${group.color}: ${group.items.length} → ${dedupedItems.length} items`);
                }
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
            const rateLabel = `WA Sales Tax (${ratePercent}%)`;
            totalsHtml += `
                <div class="total-row tax-row">
                    <span class="label">${rateLabel}:</span>
                    <span class="value">${this.formatCurrency(taxAmount)}</span>
                </div>
            `;
        } else {
            // Phase 7: CEMB quotes that confirmed tax-exempt in the pre-flight
            // show "Tax-exempt" instead of "Out of State Sales" (which is
            // the existing default for other quote types with TaxRate=0).
            // Wholesale/resale quotes (builder checkbox saves IsWholesale='Yes' with
            // TaxRate 0) get their own label — they're not out of state.
            const isWholesale = this.quoteData?.IsWholesale === 'Yes' || this.quoteData?.IsWholesale === true;
            const isCEMB = (this.quoteId || '').startsWith('CEMB');
            // WQ web-cart quotes save TaxRate 0 by design (no shipping address
            // yet — the rep calculates tax at confirmation), so "Out of State
            // Sales" would be wrong/alarming for them.
            const isWebQuote = (this.quoteId || '').startsWith('WQ');
            const zeroTaxLabel = isWholesale
                ? 'Wholesale / Resale — No Tax (permit on file)'
                : (isCEMB ? 'Tax-exempt'
                    : (isWebQuote ? 'Sales tax — calculated by your rep' : 'Out of State Sales'));
            totalsHtml += `
                <div class="total-row tax-row">
                    <span class="label">${zeroTaxLabel}:</span>
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
        let acceptedDm = '';

        try {
            const notes = JSON.parse(this.quoteData.Notes || '{}');
            acceptedDate = notes.acceptedAt ? this.formatDate(notes.acceptedAt) : '';
            acceptedBy = notes.acceptedByName || '';
            acceptedDm = notes.acceptedDeliveryMethod === 'pickup' ? 'Pickup — Milton, WA'
                : (notes.acceptedDeliveryMethod === 'ship' ? 'Ship to customer' : '');
        } catch (e) {
            console.error('Error parsing Notes JSON for acceptance info:', e);
        }

        const acceptedInfo = document.getElementById('accepted-info');
        acceptedInfo.textContent = `Accepted on ${acceptedDate}${acceptedBy ? ` by ${acceptedBy}` : ''}${acceptedDm ? ` · ${acceptedDm}` : ''}`;

        // Hide accept button
        document.getElementById('accept-quote-btn').style.display = 'none';
    }

    // ====================================================================
    // ShopWorks sync strip (Erik 2026-05-21)
    // ====================================================================
    // Renders a status pill ("Pending import" / "ShopWorks #N") + Refresh
    // button under the quote header. Auto-syncs in background if local
    // data is > 30 min stale. Manual Refresh button forces an immediate
    // pull. Both call POST /api/quote-sessions/:quoteId/sync-from-shopworks
    // which writes 4 ShopWorks_* columns in quote_sessions and (when
    // ShopWorks has deleted the order) hard-deletes the row.
    // ====================================================================

    async setupShopWorksSyncStrip() {
        // Fetch the merged /full endpoint which includes the parsed
        // ShopWorks_Snapshot. Used for the sync pill + (Phase 4b+) all
        // the ShopWorks-mirrored sections.
        try {
            const r = await fetch(`/api/quote-sessions/${this.quoteId}/full${this.shareTokenParam()}`);
            if (!r.ok) {
                // 404 or 500 — the page already rendered from /api/public/quote
                // so this is non-fatal. Hide the strip and move on.
                return;
            }
            this.fullData = await r.json();
        } catch (e) {
            console.warn('[QuoteView/sync] /full fetch failed:', e.message);
            return;
        }

        // Render the strip from initial data.
        this.renderSyncStrip(this.fullData);

        // Apply ShopWorks-side data overlay on top of the original render
        // (if we already have a snapshot from a previous sync).
        if (this.fullData?.shopWorks?.snapshot) {
            this.applyShopWorksOverlay(this.fullData.shopWorks.snapshot);
        }

        // Wire the manual Refresh button.
        const btn = document.getElementById('sw-sync-refresh-btn');
        if (btn) {
            btn.addEventListener('click', () => this.syncFromShopWorks({ manual: true }));
        }

        // Manual ShopWorks Order # entry (workaround for /v1/getorderno gap)
        this._setupManualWoStrip();

        // Auto-sync in the background if data is stale (> 30 min since last
        // pull) AND the quote has been processed (in MO somewhere).
        const sw = this.fullData?.shopWorks;
        const status = this.fullData?.status || '';
        if ((status === 'Processed' || status === 'Processed - ShopWorks Failed')) {
            const lastSynced = sw?.lastSynced ? new Date(sw.lastSynced) : null;
            const minutesStale = lastSynced ? (Date.now() - lastSynced.getTime()) / 60000 : Infinity;
            if (minutesStale > 30) {
                // Fire-and-forget; UI updates when it resolves
                this.syncFromShopWorks({ manual: false }).catch(() => {});
            }
        }

        // Phase 2 change banner (Erik 2026-05-22) — show "edited in SW" notice
        // when Quote_Change_Log has unacknowledged changes for this quote.
        // Staff-only — customers viewing share links never see internal edits.
        this._loadChangeLog().catch(() => {});
    }

    // ====================================================================
    // Phase 2 — Change banner (Erik 2026-05-22)
    // ====================================================================
    // Fetches unacknowledged changes from Quote_Change_Log for this quote
    // and renders a colored banner under the SW sync strip. Banner color =
    // highest severity present (critical > warning > info). Reps click
    // "Mark all as seen" to acknowledge → next page load won't show.
    // ====================================================================

    async _loadChangeLog() {
        if (!this.isStaff) return;
        try {
            const r = await fetch(`/api/quote-change-log/${encodeURIComponent(this.quoteId)}?sinceHours=168`);
            if (!r.ok) return;
            const data = await r.json();
            const records = (data.records || []).filter(rec => !rec.Acknowledged_At);
            if (records.length === 0) return;
            this._renderChangeBanner(records);
        } catch (e) {
            console.warn('[change-log] load failed:', e.message);
        }
    }

    _renderChangeBanner(records) {
        // Clean up any existing banner (e.g. on re-sync)
        document.getElementById('sw-change-banner')?.remove();

        // Sort newest first
        records.sort((a, b) => {
            const ta = (window.CaspioDate && window.CaspioDate.parse)
                ? window.CaspioDate.parse(a.ChangedAt) : new Date(a.ChangedAt);
            const tb = (window.CaspioDate && window.CaspioDate.parse)
                ? window.CaspioDate.parse(b.ChangedAt) : new Date(b.ChangedAt);
            return (tb?.getTime() || 0) - (ta?.getTime() || 0);
        });

        // Determine max severity
        const rank = { info: 0, warning: 1, critical: 2 };
        let maxSev = 'info';
        for (const r of records) {
            if ((rank[r.Severity] ?? 0) > (rank[maxSev] ?? 0)) maxSev = r.Severity || 'info';
        }

        const palette = {
            info:     { bg: '#eff6ff', border: '#3b82f6', color: '#1e40af', icon: '✏', headline: 'This order was edited in ShopWorks' },
            warning:  { bg: '#fffbeb', border: '#f59e0b', color: '#92400e', icon: '⚠', headline: 'This order has changes that need review' },
            critical: { bg: '#fef2f2', border: '#dc2626', color: '#991b1b', icon: '🚨', headline: 'CRITICAL — ShopWorks made changes' },
        }[maxSev];

        const top3 = records.slice(0, 3);
        const hasMore = records.length > 3;
        const newestAgo = this._formatRelativeTime(records[0].ChangedAt);

        const banner = document.createElement('div');
        banner.id = 'sw-change-banner';
        banner.className = 'sw-change-banner';
        banner.style.cssText =
            `margin:8px 0;padding:12px 16px;border:1px solid ${palette.border};` +
            `background:${palette.bg};color:${palette.color};border-radius:6px;font-size:14px;line-height:1.5;`;

        const ids = records.map(r => r.PK_ID).filter(Boolean);
        const summaryRows = top3.map(r => `<li>${this.escapeHtml(this._humanizeChange(r))}</li>`).join('');
        const detailsRows = hasMore
            ? records.map(r => `<li style="margin-bottom:4px;"><span style="opacity:0.7;font-size:12px;">${this._formatRelativeTime(r.ChangedAt)}</span> &middot; ${this.escapeHtml(this._humanizeChange(r))}</li>`).join('')
            : '';

        banner.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <strong style="font-size:15px;">${palette.icon} ${palette.headline} &middot; ${records.length} change${records.length === 1 ? '' : 's'} (most recent ${this.escapeHtml(newestAgo)})</strong>
                <div>
                    <button type="button" id="sw-change-banner-ack" data-change-ids="${ids.join(',')}"
                            style="background:${palette.color};color:#fff;border:0;padding:6px 12px;border-radius:4px;font-size:13px;cursor:pointer;font-weight:600;">
                        Mark all as seen
                    </button>
                </div>
            </div>
            <ul style="margin:8px 0 0 0;padding-left:20px;">${summaryRows}</ul>
            ${hasMore ? `
                <details style="margin-top:8px;">
                    <summary style="cursor:pointer;font-size:13px;font-weight:600;opacity:0.85;">View full history (${records.length})</summary>
                    <ul style="margin:8px 0 0 0;padding-left:20px;">${detailsRows}</ul>
                </details>
            ` : ''}
        `;

        // Insert directly after the sync strip
        const syncStrip = document.getElementById('sw-sync-strip');
        if (syncStrip && syncStrip.parentNode) {
            syncStrip.parentNode.insertBefore(banner, syncStrip.nextSibling);
        }

        // Wire the acknowledge button
        document.getElementById('sw-change-banner-ack')?.addEventListener('click', () => this._acknowledgeChanges(ids));
    }

    async _acknowledgeChanges(pkIds) {
        if (!Array.isArray(pkIds) || pkIds.length === 0) return;
        const ackBy = sessionStorage.getItem('nwca_user_email')
            || sessionStorage.getItem('nwca_user_name')
            || 'unknown';
        const btn = document.getElementById('sw-change-banner-ack');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        try {
            await Promise.all(pkIds.map(id =>
                fetch(`/api/quote-change-log/${id}/acknowledge`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ acknowledgedBy: ackBy }),
                })
            ));
            // Fade out the banner
            const banner = document.getElementById('sw-change-banner');
            if (banner) {
                banner.style.transition = 'opacity 0.3s';
                banner.style.opacity = '0';
                setTimeout(() => banner.remove(), 320);
            }
        } catch (e) {
            console.error('[change-log] acknowledge failed:', e);
            if (btn) { btn.disabled = false; btn.textContent = 'Mark all as seen'; }
            alert('Failed to acknowledge changes: ' + e.message);
        }
    }

    // Map raw Caspio FieldName + values to human-readable text.
    _humanizeChange(rec) {
        const LABELS = {
            cur_SubTotal: 'Subtotal',
            cur_TotalInvoice: 'Total',
            cur_SalesTaxTotal: 'Sales Tax',
            cur_Shipping: 'Shipping',
            cur_Payments: 'Payments Received',
            cur_Balance: 'Balance Due',
            sts_ArtDone: 'Art status',
            sts_Purchased: 'Purchasing status',
            sts_Received: 'Receiving status',
            sts_Produced: 'Production status',
            sts_Shipped: 'Shipped status',
            sts_Invoiced: 'Invoiced status',
            sts_Paid: 'Payment status',
            date_RequestedToShip: 'Ship date',
            date_DropDead: 'Drop dead date',
            CustomerServiceRep: 'CSR',
            id_DesignType: 'Design type',
            id_Design: 'Design link',
            DesignName: 'Design name',
            Status: 'Order status',
        };
        const field = String(rec.FieldName || '');

        // Line item fields: LineUnitPrice[PC600|Athletic Hthr] → "PC600 (Athletic Hthr) unit price"
        let label;
        const lineMatch = field.match(/^(LineUnitPrice|LineQuantity|LineSizes|LineItem)\[(.+)\]$/);
        if (lineMatch) {
            const what = lineMatch[1] === 'LineUnitPrice' ? 'unit price'
                : lineMatch[1] === 'LineQuantity' ? 'qty'
                : lineMatch[1] === 'LineSizes' ? 'sizes' : '';
            const [pn, color] = lineMatch[2].split('|');
            const garmentLabel = color ? `${pn} (${color})` : pn;
            label = `${garmentLabel}${what ? ' ' + what : ''}`;
        } else {
            label = LABELS[field] || field;
        }

        let oldVal = (rec.OldValue == null || rec.OldValue === '') ? '(empty)' : String(rec.OldValue);
        let newVal = (rec.NewValue == null || rec.NewValue === '') ? '(empty)' : String(rec.NewValue);

        // Money formatting
        if (field.startsWith('cur_') || field.startsWith('LineUnitPrice')) {
            const fmt = v => Number.isFinite(Number(v)) ? '$' + Number(v).toFixed(2) : v;
            oldVal = fmt(oldVal);
            newVal = fmt(newVal);
        }
        // 0/1 status flips
        if (field.startsWith('sts_') && field !== 'sts_Paid' && field !== 'sts_Purchased') {
            if (oldVal === '0') oldVal = 'incomplete';
            else if (oldVal === '1') oldVal = 'complete ✓';
            if (newVal === '0') newVal = 'incomplete';
            else if (newVal === '1') newVal = 'complete ✓';
        }

        return `${label}: ${oldVal} → ${newVal}`;
    }

    async syncFromShopWorks({ manual = false, shopWorksOrderNumber = null } = {}) {
        const btn = document.getElementById('sw-sync-refresh-btn');
        const pillText = document.getElementById('sw-sync-pill-text');
        const pillIcon = document.getElementById('sw-sync-pill-icon');

        // Loading state
        if (manual && btn) {
            btn.disabled = true;
            btn.classList.add('sw-sync-refresh-btn--loading');
        }
        if (manual && pillText) {
            pillText.textContent = 'Syncing from ShopWorks…';
        }

        try {
            const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
            if (shopWorksOrderNumber) {
                opts.body = JSON.stringify({ shopWorksOrderNumber });
            }
            const r = await fetch(`/api/quote-sessions/${this.quoteId}/sync-from-shopworks`, opts);
            if (!r.ok) {
                throw new Error(`HTTP ${r.status}`);
            }
            const result = await r.json();

            // SOFT delete — order was removed from ShopWorks. We keep the
            // quote_sessions row for 30 days (audit retention) and flip
            // Status to 'Cancelled_in_ShopWorks'. The cron's purge pass will
            // hard-delete after 30d. Don't redirect — just reload the page
            // so the new "CANCELLED IN SHOPWORKS" banner renders in place.
            if (result.deleted) {
                if (manual) {
                    alert(`Order ${this.quoteId} was deleted in ShopWorks. This quote is now marked Cancelled and will be retained for 30 days.`);
                }
                window.location.reload();
                return;
            }

            // Merge fresh ShopWorks state into our local view + re-render
            this.fullData = {
                ...this.fullData,
                shopWorks: {
                    orderNumber: result.shopWorksOrderNumber,
                    status: result.status,
                    lastSynced: result.lastSynced,
                    snapshot: result.snapshot || null,
                },
            };
            this.renderSyncStrip(this.fullData);
            this._toggleManualWoStrip();

            // Phase 4b: when snapshot is present, override existing fields
            // (email, phone, PO, dates, etc.) with ShopWorks-side values and
            // render the new Designs panel.
            if (result.snapshot) {
                this.applyShopWorksOverlay(result.snapshot);
            } else if (result.note) {
                // Manual WO# was stored but /v1 doesn't have the order yet.
                // Surface that friendly message via the pill.
                if (pillText) pillText.textContent = `WO# saved — live data in ~24h`;
                if (pillIcon) pillIcon.textContent = '⏳';
            }
        } catch (e) {
            console.warn('[QuoteView/sync] sync failed:', e.message);
            if (manual && pillText) {
                pillText.textContent = 'Sync failed — try again';
                if (pillIcon) pillIcon.textContent = '⚠';
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('sw-sync-refresh-btn--loading');
            }
        }
    }

    renderSyncStrip(data) {
        const strip = document.getElementById('sw-sync-strip');
        if (!strip) return;

        const sw = data?.shopWorks;
        const status = data?.status || '';
        const isProcessed = status === 'Processed' || status === 'Processed - ShopWorks Failed';
        const isCancelled = status === 'Cancelled_in_ShopWorks';

        // CANCELLED state — show the dedicated banner instead of the sync strip.
        const cancelledBanner = document.getElementById('sw-cancelled-banner');
        if (isCancelled && cancelledBanner) {
            const ts = data?.sessionRaw?.ShopWorks_Last_Synced;
            const detail = document.getElementById('sw-cancelled-detail');
            if (detail) {
                detail.textContent = ts
                    ? ' — Order deleted in ShopWorks on ' + this.formatDate(ts) + '. This record will be purged after 30 days.'
                    : ' — Order was deleted in ShopWorks. This record will be purged after 30 days.';
            }
            cancelledBanner.style.display = 'flex';
            strip.style.display = 'none';
            return;
        }
        if (cancelledBanner) cancelledBanner.style.display = 'none';

        // Hide the strip on legacy quotes (never pushed, no sync info available).
        if (!isProcessed && !sw) {
            strip.style.display = 'none';
            return;
        }
        strip.style.display = 'flex';

        const pill = document.getElementById('sw-sync-pill');
        const pillText = document.getElementById('sw-sync-pill-text');
        const pillIcon = document.getElementById('sw-sync-pill-icon');
        const extOrderEl = document.getElementById('sw-sync-extorder');
        const tsEl = document.getElementById('sw-sync-timestamp');

        // Compose the external-order reference (always show — useful audit).
        if (extOrderEl) {
            extOrderEl.textContent = `Ref: NWCA-${this.quoteId}`;
        }

        // Determine pill variant + content.
        const swStatus = sw?.status || (isProcessed ? 'Pending' : '');
        let variant = 'pending';
        if (swStatus === 'Imported' && sw?.orderNumber) {
            variant = 'imported';
            pillText.textContent = `ShopWorks #${sw.orderNumber}`;
            pillIcon.textContent = '✓';
        } else if (swStatus === 'Pending') {
            variant = 'pending';
            pillText.textContent = 'Pending import';
            pillIcon.textContent = '⏳';
        } else {
            variant = 'unknown';
            pillText.textContent = 'Not yet synced';
            pillIcon.textContent = '?';
        }
        if (pill) {
            pill.className = `sw-sync-pill sw-sync-pill--${variant}`;
        }

        // Last-synced timestamp ("Last synced 14m ago").
        if (tsEl) {
            if (sw?.lastSynced) {
                tsEl.textContent = `Last synced ${this._formatRelativeTime(sw.lastSynced)}`;
            } else {
                tsEl.textContent = 'Never synced';
            }
        }
    }

    _setupManualWoStrip() {
        const btn = document.getElementById('sw-manual-wo-btn');
        const input = document.getElementById('sw-manual-wo-input');
        if (!btn || !input) return;

        // Decide whether to show the strip based on initial state.
        this._toggleManualWoStrip();

        const submit = async () => {
            const raw = (input.value || '').trim();
            const n = Number(raw);
            if (!Number.isInteger(n) || n <= 0 || n > 9999999) {
                alert('Please enter a valid ShopWorks Order # (numeric, e.g. 141899)');
                input.focus();
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Syncing…';
            try {
                await this.syncFromShopWorks({ manual: true, shopWorksOrderNumber: n });
            } finally {
                btn.disabled = false;
                btn.textContent = 'Set & Sync';
            }
        };
        btn.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
        });
    }

    _toggleManualWoStrip() {
        // Show the manual-entry strip when:
        //   - The quote was Processed (pushed to MO)
        //   - The auto-mapping (/v1/getorderno) didn't resolve a WO#
        //   - No WO# is yet stored on the row
        // Hide it once a WO# is set (auto or manual).
        const strip = document.getElementById('sw-manual-wo-strip');
        if (!strip) return;
        const sw = this.fullData?.shopWorks;
        const status = this.fullData?.status || '';
        const isProcessed = status === 'Processed' || status === 'Processed - ShopWorks Failed';
        const hasWoNumber = !!(sw?.orderNumber);
        strip.style.display = (isProcessed && !hasWoNumber) ? 'block' : 'none';
    }

    _formatRelativeTime(isoOrDate) {
        try {
            const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
            const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
            if (seconds < 30) return 'just now';
            if (seconds < 60) return `${seconds}s ago`;
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            return `${days}d ago`;
        } catch { return 'recently'; }
    }

    // ====================================================================
    // Phase 4b — ShopWorks overlay (Erik 2026-05-21)
    // ====================================================================
    // When a fresh snapshot is available, override existing displayed
    // fields with ShopWorks-side values (which reflect any operator edits
    // made after the original submission). Also renders the new Designs
    // panel that mirrors the ShopWorks production PDF.
    //
    // Snapshot shape (from /api/quote-sessions/:id/full):
    //   { order: {...all /orders fields...}, lineItems: [...], fetchedAt }
    // ====================================================================

    applyShopWorksOverlay(snapshot) {
        if (!snapshot || !snapshot.order) return;
        // Stash the full snapshot so sub-renders (designs panel, shipping)
        // can access pushed data (Designs.Locations, Attachments, ShippingAddresses).
        this._currentSnapshot = snapshot;
        const order = snapshot.order;
        const lineItems = snapshot.lineItems || [];

        this._overrideField('customer-name', order.CustomerName);
        // Composite contact name from first/last (ShopWorks splits them)
        const contactName = [order.ContactFirstName, order.ContactLastName].filter(Boolean).join(' ').trim();
        // Email + phone — these are the fields Erik most often edits in ShopWorks
        this._overrideField('customer-email', order.ContactEmail);
        if (order.ContactPhone) {
            this._overrideField('customer-phone', this.formatPhone(order.ContactPhone));
        }

        // PO Number — reveal the inline PO row even if it was hidden before
        if (order.CustomerPurchaseOrder) {
            this._overrideField('po-number-display', order.CustomerPurchaseOrder);
            const poRow = document.getElementById('po-number-row');
            if (poRow) poRow.style.display = 'block';
        }

        // Order # (ShopWorks WO#) — reveal the conditional row
        if (order.id_Order) {
            this._overrideField('order-number', String(order.id_Order));
            const row = document.getElementById('order-number-row');
            if (row) row.style.display = 'flex';

            // A3 (2026-05-22): also append the WO# inline to the hero header
            // so the first thing on the page reads "Quote #OF-0050 · WO #141918".
            // The WO# is already shown in the sync pill and the Quote Details
            // row below, but reps glance at the hero first.
            const heroEl = document.getElementById('quote-id-header');
            if (heroEl && !heroEl.textContent.includes('WO #')) {
                heroEl.textContent = `${heroEl.textContent} · WO #${order.id_Order}`;
            }
        }

        // Sales rep — ShopWorks CustomerServiceRep
        if (order.CustomerServiceRep) {
            this._overrideField('sales-rep', order.CustomerServiceRep);
            const row = document.getElementById('sales-rep-row');
            if (row) row.style.display = 'flex';
        }

        // Date fields (ShopWorks uses ISO dates or "MM/DD/YYYY" format)
        if (order.date_RequestedToShip) {
            this._overrideField('req-ship-date', this.formatShopWorksDate(order.date_RequestedToShip));
            const row = document.getElementById('req-ship-date-row');
            if (row) row.style.display = 'flex';
        }
        // Drop Dead Date — ShopWorks field name varies; try several
        const dropDead = order.date_DropDead || order.date_OrderDropDead || order.DropDeadDate;
        if (dropDead) {
            this._overrideField('drop-dead-date', this.formatShopWorksDate(dropDead));
            const row = document.getElementById('drop-dead-date-row');
            if (row) row.style.display = 'flex';
        }

        // Customer Number — id_Customer from ShopWorks
        if (order.id_Customer) {
            this._overrideField('customer-number-display', String(order.id_Customer));
            const row = document.getElementById('customer-number-row');
            if (row) row.style.display = 'flex';
        }

        // Mark fields visually as "from ShopWorks" so reps know what they're
        // looking at (subtle tint, no extra DOM).
        this._markFieldsAsShopWorksSource();

        // Phase 4d: Billing address sub-block under "Prepared For"
        this._renderBillingBlock(order);

        // Render the new Designs panel
        this._renderDesignsPanel(order, lineItems);

        // Phase 4c — Status grid, Notes, Shipping panels
        this._renderStatusGrid(order);
        this._renderNotesPanel();
        this._renderShippingPanel(order);

        // Phase 4d — Financial Summary panel + payments list (NEW)
        this._renderFinancialPanel(order);
        this._renderPaymentsList(snapshot.payments || []);

        // Phase 4d+ — Tracking section on shipping panel (NEW)
        this._renderTrackingInShippingPanel(snapshot.tracking || [], order);

        // Inbound vendor (SanMar) blank-goods shipment (2026-06-15). Async,
        // fire-and-forget so it never blocks the rest of the overlay.
        this._renderVendorShipmentPanel();

        // Phase 4e — View Original Submission audit panel
        this._renderOriginalSubmissionPanel(order);

        // Phase 4d+ — Stale-data warning if last sync > 24 hrs ago
        this._renderStaleSyncWarning();

        // B2 (2026-05-22) — flag $0 line items in the SW snapshot so reps
        // catch billing-blocker pushes (e.g. WO 141918 / OF-0050) before AR
        // tries to invoice an empty order.
        this._renderZeroPriceWarning(lineItems);

        // D1 (Erik 2026-05-22): once a SW snapshot is present, overlay the
        // prominent quote-view top totals + per-line Unit/Total cells so
        // they mirror ShopWorks (matches the invoice page's behavior at
        // pages/js/invoice.js:765 — `fromOrder` fallback chain). Aligns
        // with the "SW is source of truth post-import" principle.
        this._overlayQuoteFromShopWorks(order, lineItems);

        // B (2026-05-22): refresh the ShipStation button now that we know
        // the order's production state + ship method from the snapshot.
        this._updateShipStationButton(order, snapshot);

        // Send to Steve (2026-06-26): a real ShopWorks order now exists, so the
        // SW order ID + art/design number are available — reveal the button.
        this._updateSendToSteveButton(order);

        // Quote Timeline (#15): the snapshot may carry a ShopWorks ship date —
        // re-render so the staff-only "Shipped" event appears. Reuses the
        // already-fetched snapshot (this._currentSnapshot); no extra request.
        this._renderTimeline();
    }

    // ====================================================================
    // Quote Timeline (#15, 2026-07-05)
    // ====================================================================
    // Collapsible "Timeline" panel assembled ONLY from data the page already
    // has (or one cheap staff-only analytics GET):
    //   • Created            — quoteData.CreatedAt_Quote        (everyone)
    //   • Customer viewed    — quote_analytics customer_view     (staff only)
    //   • Accepted           — Notes JSON acceptedAt/ByName      (everyone)
    //   • Pushed to ShopWorks— quoteData.PushedToShopWorks       (staff only)
    //   • Shipped            — SW snapshot order.date_Shippied   (staff only)
    // Events that don't exist simply don't render. All values are escaped.
    // Caspio timestamps parse via window.CaspioDate.parse when available
    // (never append 'Z' — see memory/caspio_pacific_timestamps.md).
    // ====================================================================

    async _initTimeline() {
        if (!this.quoteData) return;

        // Staff-only: fetch customer_view analytics (same endpoint + parse the
        // EMB builder's "Customer viewed" toast uses — embroidery-quote-builder.js).
        // Telemetry only — failures never block the timeline.
        this._timelineViews = null;
        if (this.isStaff) {
            try {
                const resp = await fetch(`${this.apiBaseUrl}/api/quote_analytics?quoteID=${encodeURIComponent(this.quoteId)}&eventType=customer_view`);
                if (resp.ok) {
                    const events = await resp.json();
                    if (Array.isArray(events) && events.length > 0) {
                        const dates = events
                            .map(ev => this._parseTimelineTs(ev.Timestamp || ev.CreatedAt || ev.EventDate || ev.Date_Created))
                            .filter(d => d)
                            .sort((a, b) => b - a);
                        this._timelineViews = { count: events.length, last: dates[0] || null };
                    }
                }
            } catch (e) {
                console.warn('[QuoteView/timeline] view analytics fetch failed:', e.message);
            }
        }

        this._renderTimeline();
    }

    /** Guarded Caspio-timestamp parse (Pacific wall-clock — never append Z). */
    _parseTimelineTs(raw) {
        if (!raw) return null;
        const d = (window.CaspioDate && window.CaspioDate.parse)
            ? window.CaspioDate.parse(raw)
            : new Date(raw);
        return (d && !isNaN(d.getTime())) ? d : null;
    }

    /** "July 4, 2026, 2:15 PM" from a Date (time omitted when midnight-ish is unknown). */
    _formatTimelineDateTime(date) {
        if (!date || isNaN(date.getTime())) return '';
        const dStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const tStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `${dStr}, ${tStr}`;
    }

    _renderTimeline() {
        const section = document.getElementById('qv-timeline-section');
        const list = document.getElementById('qv-timeline-list');
        const meta = document.getElementById('qv-timeline-summary-meta');
        if (!section || !list || !this.quoteData) return;

        const events = [];

        // 1. Created (everyone) — some session rows populate CreatedAt but not
        // CreatedAt_Quote (e.g. imported/accepted DTG quotes), so fall back.
        const createdRaw = this.quoteData.CreatedAt_Quote || this.quoteData.CreatedAt;
        const createdTs = this._parseTimelineTs(createdRaw);
        if (createdRaw) {
            events.push({ ts: createdTs, label: 'Quote created', detail: this.formatDate(createdRaw), staff: false });
        }

        // 2. Customer viewed N× / last (staff only — analytics fetch in _initTimeline)
        if (this.isStaff && this._timelineViews && this._timelineViews.count > 0) {
            const v = this._timelineViews;
            events.push({
                ts: v.last,
                label: `Customer viewed ${v.count}×`,
                detail: v.last ? `last ${this._formatTimelineDateTime(v.last)}` : '',
                staff: true
            });
        }

        // 3. Accepted (everyone) — acceptance lives in Notes JSON, not a Caspio
        // column (same source as showAcceptedState()). Name is user input → escaped.
        if (this.quoteData.Status === 'Accepted') {
            try {
                const notes = JSON.parse(this.quoteData.Notes || '{}');
                if (notes.acceptedAt) {
                    events.push({
                        ts: this._parseTimelineTs(notes.acceptedAt),
                        label: 'Quote accepted',
                        detail: this.formatDate(notes.acceptedAt)
                            + (notes.acceptedByName ? ` by ${notes.acceptedByName}` : ''),
                        staff: false
                    });
                }
            } catch (e) { /* Notes not JSON — no acceptance detail to show */ }
        }

        // 4. Pushed to ShopWorks (staff only)
        if (this.isStaff && this.quoteData.PushedToShopWorks) {
            events.push({
                ts: this._parseTimelineTs(this.quoteData.PushedToShopWorks),
                label: 'Pushed to ShopWorks',
                detail: this.formatDate(this.quoteData.PushedToShopWorks),
                staff: true
            });
        }

        // 5. Shipped (staff only) — reuse the already-synced SW snapshot.
        // 'Shippied' is the real field name (API typo); it's a CALENDAR date,
        // so display via formatShopWorksDate (no UTC-midnight day-shift).
        const swOrder = this._currentSnapshot && this._currentSnapshot.order;
        const swShipped = swOrder && (swOrder.date_Shippied || swOrder.date_Shipped);
        if (this.isStaff && swShipped) {
            const m = String(swShipped).match(/(\d{4})-(\d{2})-(\d{2})/);
            const ts = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : this._parseTimelineTs(swShipped);
            events.push({
                ts: (ts && !isNaN(ts.getTime())) ? ts : null,
                label: 'Shipped',
                detail: this.formatShopWorksDate(swShipped),
                staff: true
            });
        }

        if (events.length === 0) {
            section.style.display = 'none';
            return;
        }

        // Chronological order; events without a parseable timestamp sink to the end.
        events.sort((a, b) => {
            const ta = a.ts ? a.ts.getTime() : Infinity;
            const tb = b.ts ? b.ts.getTime() : Infinity;
            return ta - tb;
        });

        list.innerHTML = events.map(ev => `
            <li class="qv-timeline-item${ev.staff ? ' qv-timeline-item--staff' : ''}">
                <span class="qv-timeline-dot" aria-hidden="true"></span>
                <span class="qv-timeline-label">${this.escapeHtml(ev.label)}</span>
                ${ev.detail ? `<span class="qv-timeline-detail">${this.escapeHtml(ev.detail)}</span>` : ''}
                ${ev.staff ? '<span class="qv-timeline-staff-chip" title="Only staff see this event">internal</span>' : ''}
            </li>
        `).join('');

        if (meta) {
            meta.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
        }
        section.style.display = 'block';
    }

    _updateShipStationButton(order, snapshot) {
        const btn = document.getElementById('sw-action-shipstation');
        if (!btn) return;

        // Staff-only — customers viewing share links don't see this internal
        // ops button (same staff-check pattern as the rest of the page).
        if (!this.isStaff) { btn.style.display = 'none'; return; }

        const ss = this.fullData?.shipStation;
        const pushedShip = (this.fullData?.shopWorks?.snapshot?.pushed?.ShippingAddresses || [])[0];
        const method = (pushedShip?.ShipMethod || this.fullData?.originalSubmission?.ship?.method || '').toString();
        const methodLower = method.toLowerCase();

        // Hide for pickup — no label needed
        if (methodLower.includes('pickup') || methodLower.includes('willcall')) {
            btn.style.display = 'none';
            return;
        }
        if (!order) { btn.style.display = 'none'; return; }

        const isShipped = ss && ss.status === 'shipped' && ss.trackingNumber;
        const isInShipStation = ss && ss.orderId;
        const swProduced = Number(order?.sts_Produced);

        // Production-complete gate — see invoice.js for the rationale.
        if (!isShipped && !isInShipStation && swProduced !== 1) {
            btn.style.display = 'inline-flex';
            btn.disabled = true;
            btn.innerHTML = '<span class="sw-action-icon">🕐</span> Waiting for production';
            btn.title = `Order isn't decorated yet (sts_Produced=${order?.sts_Produced ?? 'unknown'}). Enables when production marks complete.`;
            return;
        }
        btn.style.display = 'inline-flex';
        if (isShipped) {
            btn.disabled = true;
            btn.innerHTML = `<span class="sw-action-icon">📦</span> Shipped · ${this.escapeHtml(ss.trackingNumber)}`;
            btn.title = `Carrier: ${ss.trackingCarrier || 'unknown'}`;
            return;
        }
        if (isInShipStation) {
            btn.disabled = true;
            btn.innerHTML = `<span class="sw-action-icon">✓</span> In ShipStation #${this.escapeHtml(String(ss.orderId))}`;
            btn.title = 'Already pushed. Warehouse buys the label in ShipStation UI.';
            return;
        }
        // Default: production done, not yet sent → enable
        btn.disabled = false;
        btn.innerHTML = '<span class="sw-action-icon">🚢</span> Send to ShipStation';
        btn.title = 'Push this order to ShipStation. Warehouse will rate + buy the label there.';
    }

    async _sendToShipStation() {
        const btn = document.getElementById('sw-action-shipstation');
        if (!btn || btn.disabled) return;
        if (!confirm('Send this order to ShipStation? Warehouse will rate + buy the label there.')) return;
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="sw-action-icon">⏳</span> Sending…';
        try {
            const resp = await fetch(`/api/quote-sessions/${encodeURIComponent(this.quoteId)}/send-to-shipstation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok || !result.success) {
                throw new Error(result.error || `HTTP ${resp.status}`);
            }
            // Refresh /full so the new ShipStation_Order_ID + status are reflected
            const r = await fetch(`/api/quote-sessions/${encodeURIComponent(this.quoteId)}/full${this.shareTokenParam()}`);
            if (r.ok) this.fullData = await r.json();
            this._updateShipStationButton(
                this.fullData?.shopWorks?.snapshot?.order,
                this.fullData?.shopWorks?.snapshot
            );
        } catch (err) {
            console.error('[quote-view] sendToShipStation failed:', err);
            alert(`Failed to send to ShipStation: ${err.message}`);
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    _overlayQuoteFromShopWorks(order, lineItems) {
        if (!order) return;
        const fmt = (n) => {
            const v = Number(n);
            if (!Number.isFinite(v)) return '$0.00';
            return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        };

        // 1. Overlay the totals card. Only swap a row when the
        // corresponding cur_* field is a finite number (null/undefined
        // means SW didn't populate it — leave the quote-driven value).
        const totalsCard = document.querySelector('.totals-card');
        if (totalsCard) {
            const fieldByLabel = {
                subtotal: order.cur_SubTotal,
                shipping: order.cur_Shipping,
                tax:      order.cur_SalesTaxTotal,
                total:    order.cur_TotalInvoice,
            };
            totalsCard.querySelectorAll('.total-row').forEach(row => {
                const label = row.querySelector('.label')?.textContent?.toLowerCase() || '';
                const valEl = row.querySelector('.value');
                if (!valEl) return;
                let swVal = null;
                if (row.classList.contains('grand-total')) {
                    swVal = fieldByLabel.total;
                } else if (label.includes('subtotal')) {
                    swVal = fieldByLabel.subtotal;
                } else if (label.includes('shipping')) {
                    swVal = fieldByLabel.shipping;
                } else if (label.includes('tax')) {
                    swVal = fieldByLabel.tax;
                }
                if (Number.isFinite(Number(swVal))) {
                    valEl.textContent = fmt(swVal);
                    valEl.classList.add('sw-mirrored');
                }
            });
        }

        // 2. Overlay per-line Unit + Total + SIZE breakdown + Qty from the SW
        // snapshot. Match SW lineItems to rendered rows by base style + color.
        //
        // Why sizes (Erik 2026-06-26): the visible size cells are first rendered
        // from the ORIGINAL quote_items.SizeBreakdown, which sync never rewrites.
        // So a rep editing sizing in ShopWorks (e.g. swap an S for an M) — the
        // source of truth — was invisible here whenever it kept the line's total
        // qty + unit price constant (the only things this used to mirror). Now we
        // also repaint the size columns + qty from the snapshot.
        //
        // MO /lineitems Size0N → display column mapping is positional & 1:1:
        //   Size01→S  Size02→M  Size03→L(LG)  Size04→XL  Size05→2XL(XXL)
        //   Size06→catch-all(XXXL: 3XL+, OSFA, tall, youth, …)
        // Extended-SKU lines (PC54Y_2X / _3X / …) land their qty in the same
        // positional column (a _2X line → Size05), so summing Size01..Size06
        // across the base line + every extended-SKU variant for a style rebuilds
        // the full per-column distribution with no double-counting.
        if (!Array.isArray(lineItems) || lineItems.length === 0) return;
        const normalize = (s) => String(s || '').trim().toLowerCase().replace(/[\s\-_/]/g, '');
        const swLines = lineItems
            .map(li => ({ li, pn: String(li.PartNumber || '').trim().toUpperCase() }))
            .filter(x => x.pn);

        document.querySelectorAll('tr.first-row').forEach(tr => {
            const styleText = tr.querySelector('.style-col')?.textContent?.trim() || '';
            const colorText = tr.querySelector('.color-col')?.textContent?.trim() || '';
            const styleMatch = styleText.match(/^([A-Z0-9_-]+)/i);
            if (!styleMatch) return;
            const style = styleMatch[1].toUpperCase();

            // All SW lines for this style = exact base match OR a size-suffixed
            // variant of it (PC54Y + PC54Y_2X + PC54Y_3X …).
            const candidates = swLines.filter(x => x.pn === style || x.pn.startsWith(style + '_')).map(x => x.li);
            if (candidates.length === 0) return;

            // Narrow to this row's color; if exactly one SW line exists for the
            // style, accept it even on a color-label mismatch (CATALOG_COLOR like
            // "Athletic Hthr" vs display "Athletic Heather").
            let matches = candidates.filter(li => normalize(li.PartColor) === normalize(colorText));
            if (matches.length === 0 && candidates.length === 1) matches = candidates;
            if (matches.length === 0) return;

            // Aggregate weighted-avg unit price + positional size columns across
            // every matching SW line (base + extended variants).
            const cols = [0, 0, 0, 0, 0, 0];   // S, M, L, XL, 2XL, catch-all
            let totalQty = 0;
            let totalValue = 0;
            matches.forEach(li => {
                const q = Number(li.LineQuantity) || 0;
                const p = Number(li.LineUnitPrice) || 0;
                totalQty += q;
                totalValue += q * p;
                for (let i = 0; i < 6; i++) cols[i] += Number(li[`Size0${i + 1}`]) || 0;
            });
            const avgUnit = totalQty > 0 ? (totalValue / totalQty) : 0;

            // Unit + line total: mirror SW dollars regardless of size data.
            const priceEl = tr.querySelector('.price-col');
            const totalEl = tr.querySelector('.total-col');
            if (priceEl) { priceEl.textContent = fmt(avgUnit); priceEl.classList.add('sw-mirrored'); }
            if (totalEl) { totalEl.textContent = fmt(totalValue); totalEl.classList.add('sw-mirrored'); }

            // Size breakdown + qty: ONLY overlay when the per-size columns
            // reconcile with the line totals (Σcols === Σ LineQuantity). If MO
            // didn't populate Size0N (colSum 0) or the numbers don't add up, leave
            // the original quote sizes rather than paint a wrong/zero distribution —
            // price/total above are still corrected. (Erik's #1 rule: never silent-wrong.)
            const colSum = cols.reduce((a, b) => a + b, 0);
            if (colSum > 0 && colSum === totalQty) {
                const sizeCells = tr.querySelectorAll('.size-col');
                if (sizeCells.length >= 6) {
                    for (let i = 0; i < 6; i++) {
                        sizeCells[i].textContent = cols[i] > 0 ? String(cols[i]) : '';
                        sizeCells[i].classList.add('sw-mirrored');
                    }
                    const qtyEl = tr.querySelector('.qty-col');
                    if (qtyEl) { qtyEl.textContent = String(totalQty); qtyEl.classList.add('sw-mirrored'); }

                    // The first row now carries all six size columns (matching how
                    // ShopWorks itself shows the line), so collapse this group's
                    // extended-size rows into it — otherwise stale quote-side
                    // extended sizes would render alongside the corrected first row.
                    let sib = tr.nextElementSibling;
                    while (sib && sib.classList.contains('extended-row')) {
                        const next = sib.nextElementSibling;
                        sib.style.display = 'none';
                        sib.classList.add('sw-collapsed');
                        sib = next;
                    }
                }
            }
        });
    }

    _renderZeroPriceWarning(lineItems) {
        // Mount a yellow banner under the ShopWorks sync strip when one or
        // more non-fee lines have LineUnitPrice=0 + LineQuantity>0 in the
        // snapshot. Fees / services / discounts can legitimately be $0 —
        // heuristic: skip lines whose PartNumber is in a known fee/service set.
        //
        // MO field names (not what you'd expect):
        //   • LineUnitPrice — the per-unit price (null when $0)
        //   • LineQuantity  — total line quantity (sum of Size01..Size06)
        const FEE_CODES = new Set([
            'DD', 'GRT-50', '3D-EMB', 'AL', 'AL-CAP', 'DECG-FB',
            'CTR-Garmt', 'CTR-Cap', 'RUSH', 'TAX', 'SHIP', 'DISCOUNT',
            'ART', 'PATCH', 'CDP', 'FREIGHT', 'PALLET',
        ]);
        const existing = document.getElementById('sw-zero-price-warning');
        if (existing) existing.remove();

        const zeroLines = (lineItems || []).filter(li => {
            const price = Number(li?.LineUnitPrice);
            const qty   = Number(li?.LineQuantity);
            if (!(qty > 0)) return false;
            if (price > 0) return false;
            const pn = String(li?.PartNumber || '').trim().toUpperCase();
            if (!pn || FEE_CODES.has(pn)) return false;
            return true;
        });
        if (zeroLines.length === 0) return;

        const items = zeroLines.map(li => {
            const pn = li?.PartNumber || '?';
            const color = li?.PartColor || li?.Color || '';
            const qty = Number(li?.LineQuantity) || 0;
            return `${pn}${color ? ` (${color})` : ''} × ${qty}`;
        }).join(' · ');

        const banner = document.createElement('div');
        banner.id = 'sw-zero-price-warning';
        banner.className = 'sw-zero-price-warning';
        banner.style.cssText = 'margin:8px 0;padding:10px 14px;border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:6px;font-size:14px;line-height:1.4;';
        banner.innerHTML = `
            <strong>⚠ ShopWorks shows $0 on ${zeroLines.length} line${zeroLines.length === 1 ? '' : 's'}</strong> —
            verify before invoicing.<br>
            <span style="font-size:13px;opacity:0.85;">${this.escapeHtml(items)}</span>
        `;

        // Insert directly after the sync strip so it sits in the same
        // "ShopWorks-state cluster" near the top of the quote.
        const syncStrip = document.getElementById('sw-sync-strip');
        if (syncStrip && syncStrip.parentNode) {
            syncStrip.parentNode.insertBefore(banner, syncStrip.nextSibling);
        }
    }

    _renderPaymentsList(payments) {
        // Show payment history below the Financial Summary panel.
        // /v1/payments returns: id_SubPayment, FirstName, LastName, BillingCompnay,
        // BillingAddress, BillingCity, BillingState, BillingZip, CreditCardCompany,
        // PaymentDate, PaymentMethod (probably), Amount fields.
        const finSection = document.getElementById('sw-financial-section');
        if (!finSection) return;
        const existing = document.getElementById('sw-payments-list');
        if (existing) existing.remove();

        if (!payments || payments.length === 0) return;

        const list = document.createElement('div');
        list.id = 'sw-payments-list';
        list.className = 'sw-payments-list';
        list.innerHTML = `
            <h3 class="sw-payments-list-head">Payment History (${payments.length})</h3>
            <table class="sw-payments-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th class="sw-payments-amount-col">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => {
                        const date = p.PaymentDate || p.date_Payment || p.date_PaymentApplied || '';
                        // Method: prefer explicit, else infer from CreditCardCompany
                        const method = p.PaymentMethod || p.CreditCardCompany || p.PaymentType || 'Payment';
                        // Reference: card last 4, check #, etc.
                        const ref = p.LastFour || p.CheckNumber || p.TransactionID || p.PaymentReference || '';
                        const amt = Number(p.Amount || p.PaymentAmount || p.cur_Payment || 0);
                        const amtStr = '$' + amt.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        return `
                            <tr>
                                <td>${this.escapeHtml(date ? this.formatDate(date) : '—')}</td>
                                <td>${this.escapeHtml(method)}</td>
                                <td class="sw-payments-ref">${this.escapeHtml(ref || '—')}</td>
                                <td class="sw-payments-amount">${amtStr}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        finSection.appendChild(list);
    }

    _renderTrackingInShippingPanel(tracking, order) {
        // Append a tracking section to the shipping panel.
        // /v1/tracking returns: TrackingNumber, ShippingCarrier (or similar),
        // date_Shipped, BoxNumber, BoxCount, etc.
        const shipSection = document.getElementById('sw-shipping-section');
        if (!shipSection) return;
        const existing = document.getElementById('sw-tracking-block');
        if (existing) existing.remove();

        // Also update Date Shipped + # Of Boxes meta from tracking data when present.
        if (tracking && tracking.length > 0) {
            const first = tracking[0];
            const dateShipped = first.date_Shipped || first.PaymentDate || order?.date_Shippied;
            const boxCount = tracking.length;
            const dateEl = document.getElementById('sw-shipping-date');
            const boxEl = document.getElementById('sw-shipping-boxes');
            if (dateEl && dateShipped) dateEl.textContent = this.formatDate(dateShipped);
            if (boxEl) boxEl.textContent = String(boxCount);

            // Build the tracking block.
            const block = document.createElement('div');
            block.id = 'sw-tracking-block';
            block.className = 'sw-tracking-block';
            block.innerHTML = `
                <h3 class="sw-tracking-head">Tracking (${tracking.length} ${tracking.length === 1 ? 'package' : 'packages'})</h3>
                <ul class="sw-tracking-list">
                    ${tracking.map(t => {
                        const trkNum = t.TrackingNumber || t.tracking_number || '';
                        const carrier = t.ShippingCarrier || t.Carrier || t.ship_carrier || 'Carrier';
                        const link = this.getTrackingLink ? this.getTrackingLink(carrier, trkNum) : '';
                        const linkHtml = link
                            ? `<a href="${this.escapeHtml(link)}" target="_blank" rel="noopener">${this.escapeHtml(trkNum)}</a>`
                            : this.escapeHtml(trkNum || '—');
                        const date = t.date_Shipped || '';
                        return `<li>
                            <span class="sw-tracking-carrier">${this.escapeHtml(carrier)}</span>
                            <span class="sw-tracking-num">${linkHtml}</span>
                            ${date ? `<span class="sw-tracking-date">${this.escapeHtml(this.formatDate(date))}</span>` : ''}
                        </li>`;
                    }).join('')}
                </ul>
            `;
            shipSection.appendChild(block);
        }
    }

    // Inbound vendor (SanMar) blank-goods shipment. Looks up the SanMar PO for
    // this order's work order and shows whether the blanks shipped from SanMar
    // to us (carrier + tracking once shipped). Auto-loaded on overlay; async so
    // it never blocks rendering. Backed by /api/quote-sessions/:id/vendor-shipment.
    async _renderVendorShipmentPanel() {
        const section = document.getElementById('sw-vendor-shipment-section');
        const body = document.getElementById('sw-vendor-body');
        if (!section || !body) return;
        const woId = this._currentSnapshot?.order?.id_Order
            || this.fullData?.shopWorks?.orderNumber
            || this.quoteData?.ShopWorks_Order_Number;
        if (!woId) return; // not imported into ShopWorks yet → no WO# to look up
        section.style.display = '';
        body.innerHTML = '<span class="sw-vendor-loading">Checking SanMar…</span>';
        try {
            const r = await fetch(`/api/quote-sessions/${encodeURIComponent(this.quoteId)}/vendor-shipment?woId=${encodeURIComponent(woId)}`);
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
            body.innerHTML = this._vendorShipmentHtml(data);
        } catch (e) {
            // Erik's #1 rule — surface the failure, never a wrong "shipped".
            body.innerHTML = `<span class="sw-vendor-error">Couldn't check SanMar shipment status (${this.escapeHtml(e.message)}).</span>`;
        }
    }

    _vendorShipmentHtml(data) {
        if (!data || !data.linked || !Array.isArray(data.pos) || data.pos.length === 0) {
            return `<span class="sw-vendor-empty">No SanMar PO linked to this order yet.</span>`;
        }
        const STATE_LABEL = {
            shipped: 'Shipped', partial: 'Partially shipped', complete: 'Complete',
            confirmed: 'Confirmed — not yet shipped', canceled: 'Canceled', unknown: 'Status unknown',
        };
        return data.pos.map(po => {
            const state = po.state || 'unknown';
            const label = STATE_LABEL[state] || (po.status || 'Status unknown');
            const head = `
                <div class="sw-vendor-head">
                    <span class="sw-vendor-po">SanMar PO ${this.escapeHtml(po.po || '—')}</span>
                    <span class="sw-vendor-pill sw-vendor-pill--${this.escapeHtml(state)}">${this.escapeHtml(label)}</span>
                    ${po.estimatedDelivery ? `<span class="sw-vendor-eta">Est. ${this.escapeHtml(this.formatDate(po.estimatedDelivery))}</span>` : ''}
                </div>`;
            let bodyHtml;
            if (po.boxes && po.boxes.length) {
                bodyHtml = `<ul class="sw-tracking-list">` + po.boxes.map(b => {
                    const num = b.trackingNumber || '';
                    const linkHtml = (b.trackingUrl && num)
                        ? `<a href="${this.escapeHtml(b.trackingUrl)}" target="_blank" rel="noopener">${this.escapeHtml(num)}</a>`
                        : this.escapeHtml(num || '—');
                    return `<li>
                        <span class="sw-tracking-carrier">${this.escapeHtml(b.carrier || 'Carrier')}</span>
                        <span class="sw-tracking-num">${linkHtml}</span>
                        ${b.shipDate ? `<span class="sw-tracking-date">${this.escapeHtml(this.formatDate(b.shipDate))}</span>` : ''}
                    </li>`;
                }).join('') + `</ul>`;
            } else if (po.shipped) {
                bodyHtml = `<div class="sw-vendor-note">Marked shipped — tracking not available yet.</div>`;
            } else {
                bodyHtml = `<div class="sw-vendor-note">Blanks not yet shipped from SanMar.</div>`;
            }
            const warn = po.error
                ? `<div class="sw-vendor-note sw-vendor-note--warn">Live status unavailable — showing last synced data.</div>`
                : '';
            return `<div class="sw-vendor-po-block">${head}${bodyHtml}${warn}</div>`;
        }).join('');
    }

    _renderOriginalSubmissionPanel(order) {
        // Show a collapsible audit panel comparing the original push data
        // (from quote_sessions.Notes JSON) against the current ShopWorks state.
        // Visual diff: changed fields get a side-by-side "before → after" row.
        const section = document.getElementById('sw-original-section');
        const body = document.getElementById('sw-original-body');
        const meta = document.getElementById('sw-original-summary-meta');
        if (!section || !body) return;

        const original = this.fullData?.originalSubmission;
        if (!original) {
            section.style.display = 'none';
            return;
        }

        // Identify diffs between original push and current ShopWorks state.
        // Each entry: { label, original, current, isDiff }
        const info = original.info || {};
        const ship = original.ship || {};
        const breakdown = original.breakdown || {};
        const rows = Array.isArray(original.rows) ? original.rows : [];

        // Helper to make a diff row
        const norm = (v) => (v == null || v === '') ? '—' : String(v).trim();
        const mkRow = (label, originalVal, currentVal) => {
            const o = norm(originalVal);
            const c = norm(currentVal);
            const isDiff = o !== c && o !== '—' && c !== '—';
            return { label, original: o, current: c, isDiff };
        };

        const diffRows = [
            mkRow('Customer email', info.email || info.buyerEmail, order.ContactEmail),
            mkRow('Customer phone', info.phone, order.ContactPhone),
            mkRow('PO Number', info.po, order.CustomerPurchaseOrder),
            mkRow('Sales rep', info.salesRep, order.CustomerServiceRep),
            mkRow('Terms', info.terms || info.paymentTerms, order.TermsName),
            mkRow('Subtotal',
                  breakdown.subtotal != null ? '$' + Number(breakdown.subtotal).toFixed(2) : '',
                  order.cur_SubTotal != null ? '$' + Number(order.cur_SubTotal).toFixed(2) : ''),
            mkRow('Tax',
                  breakdown.taxEstimate != null ? '$' + Number(breakdown.taxEstimate).toFixed(2) : '',
                  order.cur_SalesTaxTotal != null ? '$' + Number(order.cur_SalesTaxTotal).toFixed(2) : ''),
            mkRow('Ship method',
                  ship.methodLabel || ship.method,
                  this._currentSnapshot?.pushed?.ShippingAddresses?.[0]?.ShipMethod),
        ];

        const diffsCount = diffRows.filter(r => r.isDiff).length;
        if (meta) {
            meta.textContent = diffsCount > 0
                ? `${diffsCount} field${diffsCount === 1 ? '' : 's'} changed in ShopWorks`
                : 'No changes detected since submit';
            meta.className = 'sw-original-summary-meta' + (diffsCount > 0 ? ' sw-original-summary-meta--changed' : '');
        }

        // Build the body content
        const diffTable = `
            <table class="sw-original-table">
                <thead>
                    <tr>
                        <th>Field</th>
                        <th>Original submission</th>
                        <th>Current ShopWorks</th>
                    </tr>
                </thead>
                <tbody>
                    ${diffRows.map(r => `
                        <tr class="${r.isDiff ? 'sw-original-row--diff' : ''}">
                            <td class="sw-original-label">${this.escapeHtml(r.label)}</td>
                            <td class="sw-original-value sw-original-value--original">${this.escapeHtml(r.original)}</td>
                            <td class="sw-original-value sw-original-value--current">
                                ${r.isDiff ? '<span class="sw-original-arrow">→</span> ' : ''}${this.escapeHtml(r.current)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Original line items snapshot
        const lineItemsHtml = rows.length === 0 ? '' : `
            <div class="sw-original-subsection">
                <h4 class="sw-original-subheader">Original line items (${rows.length})</h4>
                <ul class="sw-original-rows-list">
                    ${rows.map(r => {
                        const sizes = r.sizes || {};
                        const pairs = Object.entries(sizes)
                            .filter(([, q]) => Number(q) > 0)
                            .map(([sz, q]) => `${sz}×${Number(q)}`).join(', ');
                        const totalPcs = Object.values(sizes).reduce((s, q) => s + (Number(q) || 0), 0);
                        return `<li><strong>${this.escapeHtml(r.style || '?')}</strong>${r.colorName ? ' · ' + this.escapeHtml(r.colorName) : ''} — ${this.escapeHtml(pairs || '0 pcs')} (${totalPcs} pcs)</li>`;
                    }).join('')}
                </ul>
            </div>
        `;

        // Original artwork / design # snapshot
        const originalDesign = info.designNumber || '';
        const originalArt = original.files && original.files.length > 0
            ? `${original.files.length} file(s) uploaded at submit`
            : (originalDesign ? `Design # ${originalDesign}` : 'No design info captured');

        body.innerHTML = `
            <div class="sw-original-intro">
                What we pushed to ManageOrders on submit, vs. what ShopWorks currently has.
                Differences are <strong>highlighted</strong>.
            </div>
            ${diffTable}
            <div class="sw-original-design-snapshot">
                <strong>Original art:</strong> ${this.escapeHtml(originalArt)}
            </div>
            ${lineItemsHtml}
        `;

        section.style.display = 'block';
    }

    _setupQuickActions() {
        const printBtn = document.getElementById('sw-action-print');
        const copyBtn = document.getElementById('sw-action-copy-link');
        const emailBtn = document.getElementById('sw-action-email');
        const ssBtn = document.getElementById('sw-action-shipstation');

        // B (2026-05-22): wire ShipStation button. Visibility decided by
        // _updateShipStationButton() — runs from applyShopWorksOverlay once
        // snapshot lands. Staff-only (gated on this.isStaff).
        if (ssBtn) {
            ssBtn.addEventListener('click', () => this._sendToShipStation());
        }

        if (printBtn) {
            printBtn.addEventListener('click', () => window.print());
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<span class="sw-action-icon">✓</span> Copied!';
                    copyBtn.classList.add('sw-action-btn--success');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                        copyBtn.classList.remove('sw-action-btn--success');
                    }, 1800);
                } catch (e) {
                    alert('Copy failed — your browser blocked clipboard access. URL: ' + window.location.href);
                }
            });
        }

        if (emailBtn) {
            emailBtn.addEventListener('click', () => {
                const email = this.quoteData?.CustomerEmail
                    || this._currentSnapshot?.order?.ContactEmail
                    || '';
                const customerName = this.quoteData?.CustomerName || 'Customer';
                const subject = `Your Quote ${this.quoteId} from Northwest Custom Apparel`;
                const body = [
                    `Hi ${customerName.split(' ')[0]},`,
                    '',
                    `Here's the link to your quote:`,
                    window.location.href,
                    '',
                    'Let me know if you have any questions!',
                    '',
                    '— Northwest Custom Apparel',
                    '(253) 922-5793',
                ].join('\n');
                const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                window.location.href = mailto;
            });
        }

        // Send to Steve (2026-06-26). Visibility decided by
        // _updateSendToSteveButton() once the ShopWorks snapshot lands.
        const steveBtn = document.getElementById('sw-action-send-steve');
        if (steveBtn) {
            steveBtn.addEventListener('click', () => this._openSendToSteve());
        }
        const stsClose = document.getElementById('sts-modal-close');
        const stsBackdrop = document.getElementById('sts-modal-backdrop');
        const closeSts = () => { const m = document.getElementById('sts-modal'); if (m) m.style.display = 'none'; };
        if (stsClose) stsClose.addEventListener('click', closeSts);
        if (stsBackdrop) stsBackdrop.addEventListener('click', closeSts);
    }

    // ── Send to Steve (2026-06-26) ──────────────────────────────────────────
    // Opens Steve's garment art form (shared GarmentSubmitForm) pre-filled from
    // the ShopWorks-synced order, with the customer's art + approved mockups
    // carried over as real reference files. Gated on a real ShopWorks order in
    // ManageOrders — Erik: the SW order ID + art number must be present first.

    _updateSendToSteveButton(order) {
        const btn = document.getElementById('sw-action-send-steve');
        if (!btn) return;
        const hasOrder = !!(this.isStaff && order && order.id_Order);
        btn.style.display = hasOrder ? '' : 'none';
    }

    async _openSendToSteve() {
        const order = this._currentSnapshot && this._currentSnapshot.order;
        if (!order || !order.id_Order) {
            alert("This order isn't in ShopWorks yet. Sync the ShopWorks order first, then Send to Steve.");
            return;
        }
        const btn = document.getElementById('sw-action-send-steve');
        const orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="sw-action-icon">⏳</span> Loading…'; }
        try {
            await this._ensureSteveFormLoaded();
            if (typeof GarmentSubmitForm === 'undefined') throw new Error('art form bundle failed to load');
            const prefill = this._buildSteveArtPrefill();
            const modal = document.getElementById('sts-modal');
            GarmentSubmitForm.init('sts-form-mount', {
                prefill: prefill,
                onSubmitted: (designId) => {
                    if (modal) modal.style.display = 'none';
                    alert(designId
                        ? ('Sent to Steve — art request #' + designId + ' created.')
                        : 'Sent to Steve.');
                }
            });
            if (modal) modal.style.display = 'flex';
        } catch (err) {
            console.error('[quote-view] Send to Steve failed:', err);
            alert("Couldn't open Steve's form: " + (err && err.message ? err.message : 'unknown error'));
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
    }

    // Lazy-load the garment art form bundle on first use so this customer-facing
    // page stays lean. Optional enhancers (pickers, date utils, emailjs) load
    // tolerantly — the form degrades to plain inputs if any are missing — but the
    // form JS itself must load. Cached after the first call.
    _ensureSteveFormLoaded() {
        if (this._steveFormLoading) return this._steveFormLoading;
        if (typeof GarmentSubmitForm !== 'undefined') { this._steveFormLoading = Promise.resolve(); return this._steveFormLoading; }
        const V = '2026.06.26.1';
        const loadScript = (src) => new Promise((resolve, reject) => {
            const base = src.split('?')[0];
            if (document.querySelector('script[data-src="' + base + '"]')) return resolve();
            const s = document.createElement('script');
            s.src = src; s.setAttribute('data-src', base);
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load ' + base));
            document.head.appendChild(s);
        });
        const loadCss = (href) => {
            const base = href.split('?')[0];
            if (document.querySelector('link[data-href="' + base + '"]')) return;
            const l = document.createElement('link');
            l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-href', base);
            document.head.appendChild(l);
        };
        loadCss('/shared_components/css/garment-submit-form.css?v=' + V);
        // app-config.js first (defines APP_CONFIG for the pickers + form API base),
        // then the optional enhancers (tolerant), then the required form JS.
        this._steveFormLoading = loadScript('/shared_components/js/app-config.js')
            .catch(() => {})
            .then(() => Promise.allSettled([
                loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'),
                loadScript('/shared_components/js/nwca-date-utils.js'),
                loadScript('/shared_components/js/customer-lookup-service.js'),
                loadScript('/shared_components/js/design-name-picker.js'),
                loadScript('/shared_components/js/work-order-picker.js')
            ]))
            .then(() => loadScript('/shared_components/js/garment-submit-form.js?v=' + V));
        return this._steveFormLoading;
    }

    _buildSteveArtPrefill() {
        const snap = this._currentSnapshot || {};
        const order = snap.order || {};
        const q = this.quoteData || {};

        const company = order.CustomerName || q.CompanyName || q.CustomerName || '';
        const contactName = [order.ContactFirstName, order.ContactLastName].filter(Boolean).join(' ').trim()
            || q.CustomerName || '';
        const contactEmail = order.ContactEmail || q.CustomerEmail || '';
        const salesRep = order.CustomerServiceRep || q.SalesRepName || q.SalesRep || '';
        const orderNum = order.id_Order ? String(order.id_Order) : '';

        // Primary design # (the art number), else the first pushed design.
        let designNum = (order.id_Design !== undefined && order.id_Design !== null && order.id_Design !== '')
            ? String(order.id_Design) : '';
        if (!designNum) {
            const d0 = (snap.pushed && Array.isArray(snap.pushed.Designs) && snap.pushed.Designs[0]) || null;
            if (d0 && d0.id_Design != null && d0.id_Design !== '') designNum = String(d0.id_Design);
        }

        const custNum = order.id_Customer ? String(order.id_Customer) : '';
        const artworkUrls = this._collectQuoteArtworkUrls();
        const notes = 'Carried over from quote ' + (this.quoteId || '')
            + (orderNum ? (' · WO ' + orderNum) : '')
            + '. Customer art + approved mockups attached from the order.';

        return {
            company: company,
            contactName: contactName,
            contactEmail: contactEmail,
            salesRep: salesRep,
            orderNum: orderNum,
            designNum: designNum,
            custNum: custNum,
            customerId: custNum,
            dueDate: this._toDateInputValue(order.date_RequestedToShip),
            decoration: this._steveDecorationFromQuote(),
            locations: this._steveLocationsFromArt(artworkUrls),
            notes: notes,
            artworkUrls: artworkUrls
        };
    }

    // Collect customer art + approved mockups from OrderSettingsJSON. Art first
    // (fills the File_Upload slots before mockups). Same source as renderCustomerArtwork().
    _collectQuoteArtworkUrls() {
        const out = [];
        try {
            const raw = this.quoteData && this.quoteData.OrderSettingsJSON;
            if (!raw) return out;
            const s = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            if (!s || typeof s !== 'object') return out;
            if (s.frontLogo && s.frontLogo.fileUrl) {
                out.push({ url: s.frontLogo.fileUrl, fileName: s.frontLogo.fileName || 'front-artwork', displayName: 'Front artwork' });
            }
            if (s.backLogo && s.backLogo.fileUrl) {
                out.push({ url: s.backLogo.fileUrl, fileName: s.backLogo.fileName || 'back-artwork', displayName: 'Back artwork' });
            }
            (Array.isArray(s.mockups) ? s.mockups : []).forEach((m, i) => {
                if (!m || !m.url) return;
                const view = (m.view ? String(m.view) : ('mockup-' + (i + 1)));
                out.push({ url: m.url, fileName: (this.quoteId || 'mockup') + '-' + view + '.png', displayName: 'Mockup — ' + view });
            });
        } catch (e) {
            console.warn('[quote-view] could not collect quote artwork:', e);
        }
        return out;
    }

    // Derive location rows from which art the customer provided (front/back).
    _steveLocationsFromArt(artworkUrls) {
        const locs = [];
        (artworkUrls || []).forEach((a) => {
            if (a.displayName === 'Front artwork') locs.push({ placement: 'Full Front', width: '' });
            else if (a.displayName === 'Back artwork') locs.push({ placement: 'Full Back', width: '' });
        });
        return locs.length ? locs : [{ placement: 'Full Front', width: '' }];
    }

    // Map the quote prefix to a garment-form decoration value (best-effort —
    // staff can change it). Values MUST match DECORATION_METHODS in garment-submit-form.js.
    _steveDecorationFromQuote() {
        const id = String(this.quoteId || '').toUpperCase();
        const m = /^([A-Z]+)/.exec(id);
        const prefix = m ? m[1] : '';
        const MAP = {
            DTG: 'DTG',
            EMB: 'Embroidery', EMBC: 'Embroidery', CEMB: 'Embroidery', CAP: 'Embroidery', RICH: 'Embroidery',
            DTF: 'Transfer',
            SPC: 'Screen Print',
            STK: 'Sticker', PATCH: 'Laser Leatherette Patch'
        };
        return MAP[prefix] || '';
    }

    _toDateInputValue(v) {
        if (!v) return '';
        const s = String(v).trim();
        let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (m) return m[1] + '-' + m[2] + '-' + m[3];
        m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
        if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
        return '';
    }

    _renderStaleSyncWarning() {
        // Surface a small inline warning at the top of the sync strip
        // when the last sync is > 24 hours old. Reps may forget about
        // long-quiet orders; this nudges them to click Refresh.
        const pillText = document.getElementById('sw-sync-pill-text');
        if (!pillText) return;
        const sw = this.fullData?.shopWorks;
        if (!sw?.lastSynced || sw.status !== 'Imported') return;
        const minutesStale = (Date.now() - new Date(sw.lastSynced).getTime()) / 60000;
        if (minutesStale > 24 * 60) {
            // Don't overwrite the WO# pill — append a subtle indicator
            const ts = document.getElementById('sw-sync-timestamp');
            if (ts) {
                ts.style.color = '#b45309';
                ts.style.fontWeight = '600';
                ts.title = 'Data is more than 24 hours old. Click Refresh for the latest from ShopWorks.';
            }
        }
    }

    _renderFinancialPanel(order) {
        const section = document.getElementById('sw-financial-section');
        if (!section) return;
        // Bail if the order header has no financial data at all.
        const subtotal = Number(order.cur_SubTotal);
        if (!Number.isFinite(subtotal)) {
            section.style.display = 'none';
            return;
        }

        const fmt = (n) => {
            const v = Number(n);
            if (!Number.isFinite(v)) return '—';
            return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        };
        const setVal = (id, n) => {
            const el = document.getElementById(id);
            if (el) el.textContent = fmt(n);
        };

        setVal('sw-fin-subtotal', order.cur_SubTotal);
        setVal('sw-fin-tax',      order.cur_SalesTaxTotal);
        setVal('sw-fin-shipping', order.cur_Shipping);
        setVal('sw-fin-total',    order.cur_TotalInvoice);
        setVal('sw-fin-payments', order.cur_Payments);
        setVal('sw-fin-balance',  order.cur_Balance);
        const termsEl = document.getElementById('sw-fin-terms');
        if (termsEl) termsEl.textContent = order.TermsName || '—';

        // Tax rate — computed from amount ÷ (subtotal + shipping). MO doesn't
        // expose the rate directly; this back-calculates it. Useful for AR
        // to verify the destination rate is correct (10.2% Milton pickup,
        // 9.5% Sumner, 10.35% Seattle, etc.). When taxable base is 0 or tax
        // is 0, leave blank (no rate to show).
        const taxRateEl = document.getElementById('sw-fin-tax-rate');
        if (taxRateEl) {
            const subtotalNum = Number(order.cur_SubTotal) || 0;
            const shippingNum = Number(order.cur_Shipping) || 0;
            const taxNum = Number(order.cur_SalesTaxTotal) || 0;
            const taxableBase = subtotalNum + shippingNum;
            if (taxNum > 0 && taxableBase > 0) {
                const ratePct = (taxNum / taxableBase) * 100;
                taxRateEl.textContent = `${ratePct.toFixed(2)}%`;
            } else if (subtotalNum > 0 && taxNum === 0) {
                taxRateEl.textContent = '0% — out of state';
            } else {
                taxRateEl.textContent = '';
            }
        }

        section.style.display = 'block';
    }

    _renderBillingBlock(order) {
        // Render the customer's billing address. ShopWorks's /v1/orders
        // doesn't expose billing fields directly — they're on the Customer
        // record. Source priority:
        //   1. fullData.billingContact — CompanyContactsMerge2026 record
        //      (server-side fetched in /api/quote-sessions/:quoteId/full).
        //      Most authoritative; has the full street address.
        //   2. originalSubmission.info — whatever the rep typed at submit
        //      (often partial: city/state only). Fallback only.
        const billing = this.fullData?.billingContact;
        const info = this.fullData?.originalSubmission?.info || {};

        const addr  = billing?.address1 || info.address || info.address1 || '';
        const city  = billing?.city || info.city || '';
        const state = billing?.state || info.state || '';
        const zip   = billing?.zip || info.zip || '';

        // Need at least a street address OR a city+state to render.
        if (!addr && !city) return;

        const block = document.getElementById('customer-billing-block');
        if (!block) return;
        const addrEl = document.getElementById('customer-billing-address');
        const cityStateEl = document.getElementById('customer-billing-city-state');
        if (addrEl) addrEl.textContent = addr;
        if (cityStateEl) {
            const line = [city, state].filter(Boolean).join(', ') + (zip ? ' ' + zip : '');
            cityStateEl.textContent = line.trim();
        }
        block.style.display = 'block';
    }

    _overrideField(elementId, value) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const v = value == null ? '' : String(value);
        if (v.trim() && el.textContent !== v) {
            el.textContent = v;
        }
    }

    _markFieldsAsShopWorksSource() {
        // Subtle visual indicator on the field group's containing card
        // (a small ShopWorks badge in the corner of each meta card).
        const cards = document.querySelectorAll('.meta-card');
        cards.forEach(card => card.classList.add('sw-mirrored'));
    }

    _renderDesignsPanel(order, lineItems) {
        const section = document.getElementById('sw-designs-section');
        if (!section) return;

        // Multi-design support (Erik 2026-05-21): iterate ALL Designs in the
        // pushed array. ShopWorks's /v1/orders only exposes ONE id_Design
        // (the primary), but pushed/order-pull preserves the full array.
        // Each Design has its own Locations[] with art URLs.
        const allPushedDesigns = (this._currentSnapshot?.pushed?.Designs || []);
        const idDesign = Number(order.id_Design) || 0;

        // If no design at all (no pushed, no primary id_Design, no name) → hide.
        if (allPushedDesigns.length === 0 && !idDesign && !order.DesignName) {
            section.style.display = 'none';
            return;
        }

        // Counters at the top.
        const productQty = Number(order.TotalProductQuantity) || lineItems.reduce((s, li) => s + (Number(li.LineQuantity) || 0), 0);
        // Total locations across ALL designs (e.g. 2 designs × 2 locations each = 4)
        const totalLocations = allPushedDesigns.reduce((s, d) => s + ((d?.Locations || []).length), 0)
            || 1;
        const totalImprints = productQty * totalLocations;

        const productQtyEl = document.getElementById('sw-designs-product-qty');
        if (productQtyEl) productQtyEl.textContent = productQty || '—';
        const imprintsEl = document.getElementById('sw-designs-imprints');
        if (imprintsEl) imprintsEl.textContent = totalImprints || '—';

        // Render ONE row per design. When pushed data is unavailable
        // (legacy quote or sync hasn't happened), render a single row from
        // the /v1/order header.
        const tbody = document.getElementById('sw-designs-tbody');
        if (tbody) {
            if (allPushedDesigns.length === 0) {
                // Fallback: just one row from the order header
                const submittedPrintLocs = this.fullData?.originalSubmission?.printLocations || '';
                const locationsCount = submittedPrintLocs
                    ? submittedPrintLocs.split(/[+,&]/).filter(s => s.trim()).length
                    : 1;
                // Don't invent a specific location when none was submitted —
                // a hardcoded 'Left Chest' rendered blank-location quotes as a
                // wrong fact (it's what made a Full Front DTG read "Left Chest"
                // before the snapshot persisted `pushed`). (2026-06-15)
                const locationsNames = submittedPrintLocs || '(unspecified)';
                // Type fallback when `pushed` is absent (legacy / never-resynced
                // quote) and the /v1 order has no id_DesignType: derive the method
                // from the quote-ID prefix so it resolves to a real method
                // instead of 'Unknown'.
                const PREFIX_METHOD = { DTG: 'dtg', EMB: 'embroidery', EMBC: 'embroidery', CEMB: 'embroidery', SP: 'screenprint', SPC: 'screenprint', SSC: 'screenprint', DTF: 'dtf' };
                const idPrefix = (String(this.quoteId || '').match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
                const methodFallback = this.fullData?.originalSubmission?.decoConfig?.method || PREFIX_METHOD[idPrefix] || '';
                const designTypeLabel = this._resolveDesignTypeName(order.id_DesignType, methodFallback);
                tbody.innerHTML = `
                    <tr>
                        <td class="sw-designs-id">${this.escapeHtml(String(idDesign || '—'))}</td>
                        <td class="sw-designs-name">${this.escapeHtml(order.DesignName || '(no name)')}</td>
                        <td class="sw-designs-type">${this.escapeHtml(designTypeLabel)}</td>
                        <td class="sw-designs-locations" title="${this.escapeHtml(locationsNames)}">
                            ${this.escapeHtml(String(locationsCount))}<span class="sw-designs-locations-names"> (${this.escapeHtml(locationsNames)})</span>
                        </td>
                        <td class="sw-designs-imprints">${this.escapeHtml(String(productQty * locationsCount || ''))}</td>
                    </tr>
                `;
            } else {
                // Multi-design: one row per pushed design
                tbody.innerHTML = allPushedDesigns.map((d, i) => {
                    const locs = d?.Locations || [];
                    const locationsCount = locs.length || 1;
                    const locationsNames = locs.map(L => L.Location).filter(Boolean).join(' + ') || '(unspecified)';
                    const designTypeLabel = this._resolveDesignTypeName(
                        d?.id_DesignType || order.id_DesignType,
                        this.fullData?.originalSubmission?.decoConfig?.method
                    );
                    // First design uses the order's id_Design; additional ones use ExtDesignID or "—"
                    const dispId = (i === 0 && idDesign) ? idDesign : (d?.id_Design || d?.ExtDesignID || '—');
                    // Name source (Erik 2026-06-16): for the PRIMARY design (i===0)
                    // prefer the LIVE ShopWorks name (order.DesignName from /v1/orders)
                    // over the frozen push-time name (d.DesignName from /order-pull).
                    // pushed.Designs[0] carries the generic placeholder we pushed at
                    // order creation (e.g. "DTG0613-8320 - Customer Logo"); when an
                    // operator renames the design in ShopWorks (e.g. "40th Birthday
                    // National Lampoons (Full Front)"), that edit lands in /v1
                    // order.DesignName but the panel was showing the stale pushed name.
                    // This mirrors the dispId logic above, which already treats
                    // pushed.Designs[0] as the order's primary design. Additional
                    // rows (i>0) keep their own pushed names (order.DesignName only
                    // describes the primary). Falls back to the pushed name when the
                    // live name is absent, so legacy/never-synced quotes are unchanged.
                    const dispName = (i === 0)
                        ? (order.DesignName || d?.DesignName || '(no name)')
                        : (d?.DesignName || order.DesignName || '(no name)');
                    return `
                        <tr>
                            <td class="sw-designs-id">${this.escapeHtml(String(dispId))}</td>
                            <td class="sw-designs-name">${this.escapeHtml(dispName)}</td>
                            <td class="sw-designs-type">${this.escapeHtml(designTypeLabel)}</td>
                            <td class="sw-designs-locations" title="${this.escapeHtml(locationsNames)}">
                                ${this.escapeHtml(String(locationsCount))}<span class="sw-designs-locations-names"> (${this.escapeHtml(locationsNames)})</span>
                            </td>
                            <td class="sw-designs-imprints">${this.escapeHtml(String(productQty * locationsCount || ''))}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Artwork thumbnails — collect ALL locations across ALL designs.
        const allLocations = allPushedDesigns.flatMap(d => d?.Locations || []);
        this._renderArtworkThumbnails(allLocations);

        section.style.display = 'block';
    }

    _renderArtworkThumbnails(locations) {
        // Mount/replace an artwork-strip below the Designs table. Hidden if
        // no locations have images.
        const section = document.getElementById('sw-designs-section');
        if (!section) return;
        const existing = document.getElementById('sw-designs-artwork');
        const hasArt = (locations || []).some(L => L && L.ImageURL);
        if (!hasArt) {
            if (existing) existing.remove();
            return;
        }

        const html = `
            <div class="sw-designs-artwork-head">Artwork files (${locations.length})</div>
            <div class="sw-designs-artwork-grid">
                ${(locations || []).map(L => {
                    const url = L?.ImageURL || '';
                    const filename = (L?.Notes || '').split('Uploaded: ').pop() || (url.split('/').pop() || 'artwork');
                    const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
                    const code = L?.DesignCode || '';
                    return `
                        <a class="sw-designs-artwork-card" href="${this.escapeHtml(url)}" target="_blank" rel="noopener">
                            <div class="sw-designs-artwork-thumb">
                                ${isImg
                                    ? `<img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(L.Location || '')}" loading="lazy">`
                                    : `<div class="sw-designs-artwork-thumb-icon"><i class="fas fa-file"></i></div>`}
                            </div>
                            <div class="sw-designs-artwork-meta">
                                <div class="sw-designs-artwork-location">${this.escapeHtml(L.Location || code)}</div>
                                <div class="sw-designs-artwork-filename">${this.escapeHtml(filename)}</div>
                            </div>
                        </a>
                    `;
                }).join('')}
            </div>
        `;

        if (existing) {
            existing.innerHTML = html;
        } else {
            const div = document.createElement('div');
            div.id = 'sw-designs-artwork';
            div.className = 'sw-designs-artwork';
            div.innerHTML = html;
            section.appendChild(div);
        }
    }

    /**
     * Customer Artwork & Mockups (2026-06-10) — Custom T-Shirts storefront
     * orders (QuoteID prefix DTG, e.g. DTG0610-1234) store the customer's
     * ORIGINAL uploaded art files + the approved mockup renders in
     * quote_sessions.OrderSettingsJSON:
     *   frontLogo / backLogo: { fileUrl, fileName }   (Caspio Files via proxy)
     *   mockups:  [{ color, catalogColor, view, url }, ...]
     * Staff need to VIEW + DOWNLOAD these for production. Quote types that
     * don't carry these keys never mount the section. Defensive: malformed
     * JSON or missing fields must never break the rest of the page.
     */
    renderCustomerArtwork() {
        try {
            const raw = this.quoteData && this.quoteData.OrderSettingsJSON;
            if (!raw) return;

            let settings;
            try {
                settings = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            } catch (parseErr) {
                console.warn('[quote-view] OrderSettingsJSON parse failed:', parseErr);
                return;
            }
            if (!settings || typeof settings !== 'object') return;

            // Collect original art files (front/back). Both optional.
            const logos = [];
            if (settings.frontLogo && settings.frontLogo.fileUrl) {
                logos.push({ label: 'Front artwork', fileUrl: settings.frontLogo.fileUrl, fileName: settings.frontLogo.fileName || 'front-artwork' });
            }
            if (settings.backLogo && settings.backLogo.fileUrl) {
                logos.push({ label: 'Back artwork', fileUrl: settings.backLogo.fileUrl, fileName: settings.backLogo.fileName || 'back-artwork' });
            }

            // Collect approved mockups. May be absent/empty.
            const mockups = (Array.isArray(settings.mockups) ? settings.mockups : [])
                .filter(m => m && m.url);

            if (!logos.length && !mockups.length) return; // nothing to show

            // The fileUrl has no extension (proxy /api/files/<key>), so sniff
            // image-ness from the original fileName; non-images (PDF/AI/EPS)
            // get a file icon instead of a broken <img>.
            const isImageName = (name) => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(String(name || ''));

            const logoCard = (logo) => {
                const url = this.escapeHtml(logo.fileUrl);
                const name = this.escapeHtml(logo.fileName);
                const label = this.escapeHtml(logo.label);
                const thumb = isImageName(logo.fileName)
                    ? `<img src="${url}" alt="${label}" loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="cust-art-thumb-icon" style="display:none;"><i class="fas fa-file"></i></div>`
                    : `<div class="cust-art-thumb-icon"><i class="fas fa-file"></i></div>`;
                return `
                    <div class="cust-art-card">
                        <a class="cust-art-thumb" href="${url}" target="_blank" rel="noopener" title="Open full size in a new tab">
                            ${thumb}
                        </a>
                        <div class="cust-art-meta">
                            <div class="cust-art-label">${label}</div>
                            <div class="cust-art-filename" title="${name}">${name}</div>
                            <a class="cust-art-download" href="${url}" download="${name}" target="_blank" rel="noopener">
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    </div>
                `;
            };

            const mockupCard = (m, i) => {
                const url = this.escapeHtml(m.url);
                const viewRaw = String(m.view || '');
                const viewLabel = viewRaw ? viewRaw.charAt(0).toUpperCase() + viewRaw.slice(1) : `Mockup ${i + 1}`;
                const label = this.escapeHtml([viewLabel, m.color].filter(Boolean).join(' — '));
                const dlName = this.escapeHtml(
                    [this.quoteId || 'mockup', viewRaw || (i + 1), m.catalogColor || m.color || '']
                        .filter(Boolean).join('-').replace(/[^\w.-]+/g, '_') + '.png'
                );
                return `
                    <div class="cust-art-card">
                        <a class="cust-art-thumb" href="${url}" target="_blank" rel="noopener" title="Open full size in a new tab">
                            <img src="${url}" alt="${label}" loading="lazy"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="cust-art-thumb-icon" style="display:none;"><i class="fas fa-file-image"></i></div>
                        </a>
                        <div class="cust-art-meta">
                            <div class="cust-art-label">${label}</div>
                            <a class="cust-art-download" href="${url}" download="${dlName}" target="_blank" rel="noopener">
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    </div>
                `;
            };

            let html = '<h2>Customer Artwork &amp; Mockups</h2>';
            if (logos.length) {
                html += `
                    <div class="cust-art-subhead">Customer Artwork (original files)</div>
                    <div class="cust-art-grid">${logos.map(logoCard).join('')}</div>
                `;
            }
            if (mockups.length) {
                html += `
                    <div class="cust-art-subhead">Approved Mockups</div>
                    <div class="cust-art-grid">${mockups.map(mockupCard).join('')}</div>
                `;
            }

            // Mount (idempotent): reuse the section if a re-render already
            // created it, else insert right after the Quote Details items —
            // before the Special Notes section.
            let section = document.getElementById('customer-artwork-section');
            if (!section) {
                section = document.createElement('section');
                section.id = 'customer-artwork-section';
                section.className = 'cust-art-section';
                const anchor = document.getElementById('special-notes-section');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(section, anchor);
                } else {
                    const content = document.getElementById('quote-content');
                    if (!content) return;
                    content.appendChild(section);
                }
            }
            section.innerHTML = html;
        } catch (err) {
            // Never let artwork rendering break the rest of the quote page.
            console.warn('[quote-view] customer artwork render failed:', err);
        }
    }

    _resolveDesignTypeName(idDesignType, methodFallback = null) {
        // ShopWorks design type IDs per Erik's "design type translation.csv":
        //   1 = Screenprint, 2 = Embroidery, 4 = Sticker, 5 = Emblem,
        //   8 = DTF Transfer, 45 = DTG
        const TYPE_NAMES = {
            1: 'Screenprint',
            2: 'Embroidery',
            4: 'Sticker',
            5: 'Emblem',
            8: 'DTF Transfer',
            45: 'DTG',
        };
        const direct = TYPE_NAMES[Number(idDesignType)];
        if (direct) return direct;

        // C1 (2026-05-22): when SW snapshot doesn't carry id_DesignType (rare —
        // happens for OF-* quotes where MO didn't surface the field on either
        // the design or the order header), fall back to the originalSubmission's
        // decoConfig.method. Mirrors the DESIGN_TYPE_ID map in server.js:2697.
        const METHOD_TO_NAME = {
            embroidery: 'Embroidery',
            screenprint: 'Screenprint',
            dtg: 'DTG',
            dtf: 'DTF Transfer',
            sticker: 'Sticker',
            emblem: 'Emblem',
        };
        const m = String(methodFallback || '').toLowerCase();
        if (METHOD_TO_NAME[m]) return METHOD_TO_NAME[m];

        return idDesignType ? `Type ${idDesignType}` : 'Unknown';
    }

    // ====================================================================
    // Phase 4c — Status grid, Notes, Shipping panels
    // ====================================================================

    // ShopWorks sts_* code → display state, mirroring exactly what the OnSite
    // order screen shows. Encoding (memory/MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md:45):
    //   0 = No · 1 = Yes · .5 = Partial · 8 = N/A · 222 = N/A.
    // Empty/missing → "—" (not yet synced). Unknown non-empty code → n/a (never a
    // false Yes/No). KEEP IN SYNC with dashboards/quote-management.html mapSwStatus.
    _mapSwStatus(raw) {
        if (raw == null || String(raw).trim() === '') return { state: 'unknown', label: '—' };
        const s = String(raw).trim().toLowerCase();
        if (s === '1' || s === 'yes' || s === 'y' || s === 'true')  return { state: 'yes',     label: 'Yes' };
        if (s === '0' || s === 'no'  || s === 'n' || s === 'false') return { state: 'no',      label: 'No' };
        if (s === '.5' || s === '0.5' || s === 'partial')           return { state: 'partial', label: 'Partial' };
        if (s === '8' || s === '222' || s === 'n/a' || s === 'na')  return { state: 'na',      label: 'n/a' };
        return { state: 'na', label: 'n/a' };
    }

    // Combine two ShopWorks fields into one milestone (e.g. Purchase Received =
    // Purchased AND Received): No wins if either is No; else Partial if either is
    // Partial; else Yes only if BOTH Yes; else n/a if any is n/a; else "—".
    _combineSwStatus(parts) {
        const states = parts.map(p => p.state);
        if (states.includes('no'))            return { state: 'no',      label: 'No' };
        if (states.includes('partial'))       return { state: 'partial', label: 'Partial' };
        if (states.every(s => s === 'yes'))   return { state: 'yes',     label: 'Yes' };
        if (states.includes('na'))            return { state: 'na',      label: 'n/a' };
        return { state: 'unknown', label: '—' };
    }

    _renderStatusGrid(order) {
        const section = document.getElementById('sw-status-section');
        const grid = document.getElementById('sw-status-grid');
        if (!section || !grid) return;

        // 5-tile workflow snapshot (Erik 2026-05-28). Trimmed from the prior
        // 10-tile mirror of the ShopWorks UI — staff don't need Approved/
        // Art/Sub Pur/Pre at-a-glance; what they want is "where is the order
        // in the pipeline?" Each tile is a milestone:
        //   Purchase Received — goods purchased AND physically received
        //   Produced          — decoration complete
        //   Shipped           — out the door
        //   Invoiced          — invoice generated
        //   Paid              — customer paid
        // "Purchase Received" is a composite Yes only when both sts_Purchased
        // and sts_Received are Yes (received implies purchased, but ANDing
        // guards against data inconsistency).
        const STATUS_FIELDS = [
            { label: 'Purchase Received', composite: ['sts_Purchased', 'sts_Received'] },
            { label: 'Produced',          field: 'sts_Produced' },
            { label: 'Shipped',           field: 'sts_Shipped' },
            { label: 'Invoiced',          field: 'sts_Invoiced' },
            { label: 'Paid',              field: 'sts_Paid' },
        ];

        // Mirror ShopWorks status FAITHFULLY (Erik 2026-06-16). Per
        // memory/MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md:45 every sts_* uses:
        //   0 = No, 1 = Yes, .5 = Partial, 8 = N/A, 222 = N/A.
        // ShopWorks itself shows Yes / No / n/a per milestone (a Customer Pickup
        // order reads Ship: n/a, Prod: n/a), so the tile shows the SAME state — not
        // a forced Yes/No, and not the earlier "Ready for Pickup" / ship-date guess
        // (which did NOT match the OnSite order screen). Empty → "—".
        // KEEP IN SYNC with dashboards/quote-management.html mapSwStatus.
        const cells = STATUS_FIELDS.map(({ label, composite, field }) => {
            const st = composite
                ? this._combineSwStatus(composite.map(f => this._mapSwStatus(order?.[f])))
                : this._mapSwStatus(order?.[field]);
            return `
                <div class="sw-status-cell">
                    <div class="sw-status-cell-label">${this.escapeHtml(label)}</div>
                    <div class="sw-status-cell-value sw-status-cell-value--${st.state}">${this.escapeHtml(st.label)}</div>
                </div>
            `;
        }).join('');

        grid.innerHTML = cells;
        section.style.display = 'block';
    }

    _isStatusYes(raw) {
        if (raw == null || raw === '') return false;
        const s = String(raw).trim().toLowerCase();
        if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true;
        // Numeric: 0 = No, non-zero = Yes (ShopWorks convention)
        const n = Number(raw);
        if (!Number.isNaN(n)) return n > 0;
        return false;
    }

    _renderNotesPanel() {
        const section = document.getElementById('sw-notes-section');
        const list = document.getElementById('sw-notes-list');
        const footer = document.getElementById('sw-notes-footer');
        if (!section || !list) return;

        // The MO /v1 /orders endpoint doesn't expose ShopWorks-side notes,
        // and the original submission's Notes JSON doesn't store the
        // assembled "Notes To Production" block (that's built server-side
        // in buildProductionNote()). So we reconstruct the same lines
        // client-side from the structured data we DO have. Result mirrors
        // the ShopWorks PDF's Notes To Production block (1 line per fact).
        const original = this.fullData?.originalSubmission;
        if (!original) {
            section.style.display = 'none';
            return;
        }

        const lines = [];

        // 1. Decoration method (DTG / Embroidery / Screen Print / etc.)
        const method = original.decoConfig?.method || '';
        if (method) {
            const METHOD_LABELS = { dtg: 'DTG', embroidery: 'Embroidery', screenprint: 'Screen Print', dtf: 'DTF Transfer', sticker: 'Sticker', emblem: 'Emblem' };
            lines.push(METHOD_LABELS[method] || method);
        }

        // 2. Print locations (Left Chest + Full Back / Jumbo Front / etc.)
        const printLocs = original.printLocations || '';
        if (printLocs) lines.push(printLocs);

        // 3. Tier (24-47 / 48-71 / 72+)
        const tier = original.breakdown?.tier;
        if (tier) lines.push(`Tier ${tier}`);

        // 4. Line count + total qty
        const rows = Array.isArray(original.rows) ? original.rows : [];
        const validRows = rows.filter(r => r && r.style && r.sizes && Object.values(r.sizes).some(v => Number(v) > 0));
        if (validRows.length > 0) {
            lines.push(`${validRows.length} line${validRows.length === 1 ? '' : 's'}`);
        }
        const totalQty = original.breakdown?.totalQty;
        if (totalQty) lines.push(`${totalQty} combined pieces`);

        // 5. Ship method
        const shipMethod = original.ship?.methodLabel || original.ship?.method;
        if (shipMethod) lines.push(`Ship: ${shipMethod}`);

        // 6. Per-row size breakdown (mirrors the ShopWorks PDF's per-line entries)
        for (const r of validRows) {
            const sizePairs = Object.entries(r.sizes || {})
                .filter(([, q]) => Number(q) > 0)
                .map(([sz, q]) => `${sz}×${Number(q)}`);
            if (sizePairs.length === 0) continue;
            const totalPcs = sizePairs.reduce((s, p) => s + Number(p.split('×')[1] || 0), 0);
            const color = r.colorName || r.color || '';
            lines.push(`${r.style}${color ? ' ' + color : ''}: ${sizePairs.join(', ')} (${totalPcs} pcs)`);
        }

        if (lines.length === 0) {
            section.style.display = 'none';
            return;
        }

        list.innerHTML = lines.map(line => `<li>${this.escapeHtml(line)}</li>`).join('');

        if (footer) {
            footer.style.display = 'block';
            footer.textContent = 'Notes as submitted. ShopWorks operators may have added more notes — open the order in ShopWorks to see the current full list.';
        }

        section.style.display = 'block';
    }

    _renderShippingPanel(order) {
        const section = document.getElementById('sw-shipping-section');
        if (!section) return;

        // Source priority:
        //   1. snapshot.pushed.ShippingAddresses[0] — what's in MO right now
        //      (matches what ShopWorks operators see; reflects our push)
        //   2. originalSubmission.ship — the form's submission data (fallback)
        // The MO /v1/orders endpoint doesn't expose ShippingAddresses, so
        // pushed is the only source that aligns with ShopWorks-side data.
        const pushedShip = (this._currentSnapshot?.pushed?.ShippingAddresses || [])[0];
        const original = this.fullData?.originalSubmission;
        const info = original?.info || {};
        // Normalize pushed ShipAddress fields to ship.* shape used below
        const ship = pushedShip
            ? {
                methodLabel: pushedShip.ShipMethod || '',
                method: pushedShip.ShipMethod || '',
                address: pushedShip.ShipAddress01 || '',
                address2: pushedShip.ShipAddress02 || '',
                city: pushedShip.ShipCity || '',
                state: pushedShip.ShipState || '',
                zip: pushedShip.ShipZip || '',
                country: pushedShip.ShipCountry || 'USA',
                shipName: pushedShip.ShipName || '',
                shipCompany: pushedShip.ShipCompany || '',
            }
            : (original?.ship || {});

        // Detect pickup orders — render differently
        const method = (ship.method || ship.methodLabel || '').toString();
        const isPickup = method === 'Customer Pickup' || ship.isPickup === true ||
                         method.toLowerCase().includes('pickup') || method.toLowerCase().includes('willcall');

        // Date Shipped — from snapshot (the only ShopWorks-side shipping
        // signal we currently have in /orders). Note: 'Shippied' is the
        // actual field name (typo in the API).
        const dateShipped = order?.date_Shippied || order?.date_Shipped;
        const setMeta = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value || '—';
        };
        setMeta('sw-shipping-date', dateShipped ? this.formatShopWorksDate(dateShipped) : '');

        // # of Boxes — count of tracking numbers (rough proxy) when available
        // from the original Carrier/TrackingNumber fields on the quote row.
        const trackingNum = this.quoteData?.TrackingNumber || '';
        const boxCount = trackingNum ? trackingNum.split(',').filter(s => s.trim()).length : 0;
        setMeta('sw-shipping-boxes', boxCount > 0 ? String(boxCount) : '');

        // Shipped By: not currently exposed; leave empty for now
        setMeta('sw-shipping-by', '');

        // Build the address block — mirrors the ShopWorks PDF layout:
        //   Star Sportswear              ← Company (info.company)
        //   Wendy Mickelson              ← Recipient name (ship.address often
        //                                   contains this — reps put recipient
        //                                   name in line 1, street in line 2)
        //   14805 75th St. Ct. East      ← Street address (ship.address2)
        //   Sumner, WA 98390             ← city/state/zip
        //   USA                          ← country
        //   UPS Ground                   ← method
        const recipient = isPickup
            ? 'Customer Pickup at NWCA Milton'
            : (info.company || this.quoteData?.CompanyName || '—');
        document.getElementById('sw-shipping-recipient').textContent = recipient;

        let addr1, addr2, city, state, zip, country;
        if (isPickup) {
            addr1 = '2025 Freeman Road East';
            addr2 = '';
            city  = 'Milton';
            state = 'WA';
            zip   = '98354';
            country = 'USA';
        } else {
            // Both address fields rendered verbatim — convention is line 1 =
            // recipient name, line 2 = street, but we don't enforce that
            // (reps may use them either way).
            addr1 = ship.address || ship.address1 || '';
            addr2 = ship.address2 || '';
            city  = ship.city || '';
            state = ship.state || '';
            zip   = ship.zip || '';
            country = ship.country || 'USA';
        }

        document.getElementById('sw-shipping-line1').textContent = addr1;
        document.getElementById('sw-shipping-line1').style.display = addr1 ? 'block' : 'none';
        document.getElementById('sw-shipping-line2').textContent = addr2;
        document.getElementById('sw-shipping-line2').style.display = addr2 ? 'block' : 'none';
        const cityLine = [city, state].filter(Boolean).join(', ') + (zip ? ' ' + zip : '');
        document.getElementById('sw-shipping-citystate').textContent = cityLine.trim();
        document.getElementById('sw-shipping-citystate').style.display = cityLine.trim() ? 'block' : 'none';
        document.getElementById('sw-shipping-country').textContent = country;

        // Method label (UPS Ground / Customer Pickup / Priority Mail / etc.)
        const methodLabel = ship.methodLabel || method || 'Not specified';
        document.getElementById('sw-shipping-method').textContent = methodLabel;

        // Mode pill — Single Address / Multiple Addresses / No Shipping
        const mode = isPickup ? 'none' : 'single';  // multi-address support deferred
        document.querySelectorAll('.sw-shipping-mode-pill').forEach(pill => {
            const pillMode = pill.dataset.mode;
            pill.classList.toggle('sw-shipping-mode-pill--active', pillMode === mode);
        });

        // If absolutely nothing useful to show (no submission data either),
        // hide the section.
        if (!recipient || recipient === '—') {
            section.style.display = 'none';
        } else {
            section.style.display = 'block';
        }
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

        // Delivery method (pickup skip-the-rep, 2026-07-06) — required so the
        // server knows whether it can auto-enable the online payment (pickup)
        // or a rep must confirm shipping first (ship).
        const dmInput = document.querySelector('input[name="deliveryMethod"]:checked');
        const deliveryMethod = dmInput ? dmInput.value : null;
        if (!deliveryMethod) {
            alert('Please choose pickup or shipping so we know how to get your order to you.');
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
                body: JSON.stringify({ name, email, deliveryMethod })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to accept quote');
            }

            // Success
            this.closeAcceptModal();

            // Update quote data - store in Notes JSON to match server storage.
            // _depositNotes() parses safely (plain-text Notes from the EMB
            // builder → {}), so a non-JSON Notes value no longer throws and
            // skips applying data.deposit for pickup. (audit fix 2026-07-06)
            this.quoteData.Status = 'Accepted';
            try {
                const notes = this._depositNotes();
                notes.acceptedAt = data.acceptedAt;
                notes.acceptedByName = name;
                notes.acceptedByEmail = email;
                notes.acceptedDeliveryMethod = deliveryMethod;
                // Pickup auto-enabled payment: the server returns the deposit
                // block it just stamped — render the pay button immediately
                // (no reload; the proxy lookup cache would lag behind anyway).
                if (data.deposit) notes.deposit = data.deposit;
                this.quoteData.Notes = JSON.stringify(notes);
            } catch (e) {
                console.error('Error updating Notes JSON:', e);
            }

            // Update UI
            this.renderStatus();
            this.showAcceptedState();
            if (data.deposit) {
                this.renderDepositPanel(null);
                if (this.isStaff) this.setupDepositStrip();
            }

            // Success modal — pickup-with-payment gets "pay right now" copy.
            const nextSteps = document.getElementById('success-next-steps');
            if (nextSteps) {
                nextSteps.textContent = data.deposit
                    ? 'Pickup order — you can pay online right now. Close this and use the green payment box below to finish up.'
                    : (deliveryMethod === 'pickup'
                        ? 'Pickup order — our team will send your online payment link shortly.'
                        : 'Thank you for accepting this quote. Our team will confirm shipping and send your online payment link.');
            }
            document.getElementById('success-modal').style.display = 'flex';

        } catch (error) {
            console.error('Error accepting quote:', error);
            alert('We couldn\'t record your acceptance just now. Please try again in a moment, or call us at (253) 922-5793 and we\'ll finish it for you.');
        } finally {
            // Reset button state
            acceptBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }

    // ====================================================================
    // Online deposit (Storefront Checkout Phase 1, 2026-07-05)
    // ====================================================================
    // Customer panel + staff strip both read the server-owned Notes JSON
    // (`deposit` terms block + `payments[]` written by the Stripe webhook).
    // The browser NEVER computes the charged amount — "Pay deposit" calls
    // the public deposit-checkout API, which builds the Stripe session from
    // the stored terms after re-verifying the totals-hash.
    // ====================================================================

    _depositNotes() {
        try {
            const notes = JSON.parse(this.quoteData.Notes || '{}');
            return (notes && typeof notes === 'object' && !Array.isArray(notes)) ? notes : {};
        } catch (_) { return {}; }
    }

    setupDepositUI(urlParams) {
        try {
            this.renderDepositPanel(urlParams);
            if (this.isStaff) this.setupDepositStrip();
        } catch (e) {
            console.warn('[quote-view] deposit UI failed (non-fatal):', e);
        }
    }

    renderDepositPanel(urlParams) {
        const panel = document.getElementById('deposit-panel');
        if (!panel || !this.quoteData) return;
        const notes = this._depositNotes();
        const dep = notes.deposit;
        const payments = Array.isArray(notes.payments) ? notes.payments : [];
        const depositPaid = payments.find((p) => p && p.kind === 'deposit');
        const returned = urlParams ? urlParams.get('deposit') : null;

        if (!dep || !dep.enabled || this.quoteData.Status !== 'Accepted') {
            panel.style.display = 'none';
            return;
        }

        const fc = (n) => this.formatCurrency(Number(n) || 0);
        // DEPOSIT-PCT=100 (Erik 2026-07-05) → pay-in-full wording; a lower pct
        // in Caspio flips all of this back to deposit wording with no deploy.
        const payInFull = Number(dep.depositPct) >= 100;
        let banner = '';
        if (returned === 'success' && !depositPaid) {
            // The Stripe redirect can beat the webhook by a few seconds.
            banner = '<div class="deposit-banner deposit-banner-ok">&#10003; Payment submitted — your receipt is on its way. This page may take a minute to catch up.</div>';
        } else if (returned === 'canceled' && !depositPaid) {
            banner = '<div class="deposit-banner deposit-banner-warn">Checkout was canceled — no charge was made. You can pay whenever you\'re ready.</div>';
        }
        const breakdown = `
            <div class="deposit-breakdown">
                <div class="deposit-line"><span>Quote subtotal</span><span>${fc(dep.subtotal)}</span></div>
                <div class="deposit-line"><span>Shipping</span><span>${fc(dep.shipping)}</span></div>
                <div class="deposit-line"><span>Sales tax (${Number(dep.taxRatePct) || 0}%)</span><span>${fc(dep.taxAmount)}</span></div>
                <div class="deposit-line deposit-line-total"><span>Order total</span><span>${fc(dep.grandTotal)}</span></div>
            </div>`;

        if (depositPaid) {
            const balanceLine = Number(dep.balanceAmount) > 0
                ? `<div class="deposit-line deposit-line-total"><span>Balance due after proof approval</span><span>${fc(dep.balanceAmount)}</span></div>`
                : '';
            const paidNote = Number(dep.balanceAmount) > 0
                ? "We'll start on your proof right away. The balance is due after you approve it."
                : "You're paid in full. We'll start on your proof right away.";
            panel.innerHTML = `
                <div class="deposit-card">
                    <h3 class="deposit-title">&#10003; Payment received — thank you!</h3>
                    ${breakdown}
                    <div class="deposit-line deposit-line-paid"><span>Paid${depositPaid.at ? ' on ' + this.escapeHtml(this.formatDate(depositPaid.at)) : ''}</span><span>&minus;${fc(depositPaid.amount)}</span></div>
                    ${balanceLine}
                    <p class="deposit-note">${paidNote}</p>
                </div>`;
            panel.style.display = '';
            return;
        }

        const title = payInFull
            ? 'Ready when you are — pay for your order online'
            : `Ready when you are — pay your ${Number(dep.depositPct) || 0}% deposit online`;
        const dueLabel = payInFull ? 'Total due now' : `Deposit due now (${Number(dep.depositPct) || 0}%)`;
        const btnLabel = payInFull ? `Pay ${fc(dep.depositAmount)}` : `Pay ${fc(dep.depositAmount)} deposit`;
        const note = payInFull
            ? 'Secure checkout by Stripe — we never see your card number. Prefer phone? Call (253) 922-5793.'
            : `Secure checkout by Stripe — we never see your card number. Balance of ${fc(dep.balanceAmount)} is due after proof approval. Prefer phone? Call (253) 922-5793.`;
        panel.innerHTML = `
            ${banner}
            <div class="deposit-card">
                <h3 class="deposit-title">${title}</h3>
                ${breakdown}
                <div class="deposit-line deposit-line-due"><span>${dueLabel}</span><span>${fc(dep.depositAmount)}</span></div>
                <button type="button" class="btn btn-primary deposit-pay-btn" id="deposit-pay-btn">${btnLabel}</button>
                <p class="deposit-note">${note}</p>
            </div>`;
        panel.style.display = '';
        const btn = document.getElementById('deposit-pay-btn');
        if (btn) btn.addEventListener('click', () => this.startDepositCheckout(btn));
    }

    async startDepositCheckout(btn) {
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Opening secure checkout…';
        try {
            const resp = await fetch(`/api/public/quote/${encodeURIComponent(this.quoteId)}/deposit-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.url) throw new Error(data.error || 'Could not start checkout');
            window.location.href = data.url;
        } catch (e) {
            console.error('[quote-view] deposit checkout failed:', e);
            alert((e.message || 'Could not start checkout.') + ' Please try again, or call (253) 922-5793 and we\'ll take it by phone.');
            btn.disabled = false;
            btn.textContent = original;
        }
    }

    setupDepositStrip() {
        const strip = document.getElementById('qv-deposit-strip');
        if (!strip || !this.quoteData) return;
        const notes = this._depositNotes();
        const dep = notes.deposit;
        const payments = Array.isArray(notes.payments) ? notes.payments : [];
        const depositPaid = payments.find((p) => p && p.kind === 'deposit');
        const state = document.getElementById('qv-deposit-state');
        const form = document.getElementById('qv-deposit-form');
        strip.style.display = '';

        if (depositPaid) {
            state.textContent = `Paid ${this.formatCurrency(Number(depositPaid.amount) || 0)}${depositPaid.at ? ' on ' + this.formatDate(depositPaid.at) : ''}`;
            state.className = 'qv-deposit-strip-state is-paid';
            form.style.display = 'none';
            return;
        }
        if (this.quoteData.Status !== 'Accepted') {
            state.textContent = 'Waiting for customer acceptance';
            state.className = 'qv-deposit-strip-state';
            form.style.display = 'none';
            return;
        }
        if (dep && dep.enabled) {
            state.textContent = Number(dep.depositPct) >= 100
                ? `Link live — ${this.formatCurrency(dep.depositAmount)} full payment`
                : `Link live — ${this.formatCurrency(dep.depositAmount)} deposit (${Number(dep.depositPct) || 0}% of ${this.formatCurrency(dep.grandTotal)})`;
            state.className = 'qv-deposit-strip-state is-live';
            document.getElementById('qv-deposit-shipping').value = Number(dep.shipping) || 0;
            document.getElementById('qv-deposit-taxrate').value = Number(dep.taxRatePct) || 0;
            document.getElementById('qv-deposit-enable-btn').textContent = 'Update payment link';
        } else {
            state.textContent = 'Not enabled';
            state.className = 'qv-deposit-strip-state';
        }
        form.style.display = '';

        // Wire once — setupDepositStrip re-runs after enable/update.
        if (!this._depositStripWired) {
            this._depositStripWired = true;
            const preview = () => this._updateDepositPreview();
            document.getElementById('qv-deposit-shipping').addEventListener('input', preview);
            document.getElementById('qv-deposit-taxrate').addEventListener('input', preview);
            document.getElementById('qv-deposit-enable-btn').addEventListener('click', () => this.enableDeposit());
        }
        this._updateDepositPreview();
    }

    _updateDepositPreview() {
        const el = document.getElementById('qv-deposit-preview');
        if (!el) return;
        try {
            // depositPct 100 → grand-total math only. The REAL split comes from
            // the server (Service_Codes DEPOSIT-PCT) when the rep clicks Enable —
            // this preview exists so the rep sees tax/total before committing.
            const t = window.QuoteDepositMath.computeDepositTerms({
                subtotal: parseFloat(this.quoteData.TotalAmount),
                shipping: parseFloat(document.getElementById('qv-deposit-shipping').value),
                taxRatePct: parseFloat(document.getElementById('qv-deposit-taxrate').value),
                depositPct: 100
            });
            el.textContent = `Order total ${this.formatCurrency(t.grandTotal)} (tax ${this.formatCurrency(t.taxAmount)})`;
        } catch (_) {
            el.textContent = '';
        }
    }

    async enableDeposit() {
        const btn = document.getElementById('qv-deposit-enable-btn');
        const shipping = parseFloat(document.getElementById('qv-deposit-shipping').value);
        const taxRatePct = parseFloat(document.getElementById('qv-deposit-taxrate').value);
        if (!Number.isFinite(shipping) || !Number.isFinite(taxRatePct)) {
            alert('Enter shipping dollars (0 for pickup) and the confirmed tax rate % (0 for out-of-state).');
            return;
        }
        btn.disabled = true;
        try {
            const resp = await fetch(`/api/quotes/${encodeURIComponent(this.quoteId)}/enable-deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shipping, taxRatePct })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.success) throw new Error(data.error || `HTTP ${resp.status}`);
            // Refresh the local copy so both surfaces re-render the stored terms.
            const notes = this._depositNotes();
            notes.deposit = data.deposit;
            this.quoteData.Notes = JSON.stringify(notes);
            this.setupDepositStrip();
            this.renderDepositPanel(null);
            let copied = false;
            try { await navigator.clipboard.writeText(data.payUrl); copied = true; } catch (_) { /* clipboard blocked */ }
            alert(`Deposit enabled: ${this.formatCurrency(data.deposit.depositAmount)} of ${this.formatCurrency(data.deposit.grandTotal)}.` +
                (copied ? ' Pay link copied to clipboard.' : ' Share the quote link with the customer.'));
        } catch (e) {
            alert('Enable deposit failed: ' + (e.message || 'unknown error'));
        } finally {
            btn.disabled = false;
        }
    }

    // PDF Generation
    // Phase 11 (2026-05-14): switched from jsPDF (600 LOC of brittle
    // coordinate-positioning code) to native browser print-to-PDF.
    // HTML/CSS print stylesheet (quote-print.css) drives the invoice
    // layout. Vector text, selectable, smaller files, 5x easier to
    // maintain. User picks "Save as PDF" in Chrome's print dialog.
    downloadPdf() {
        // Brief visual feedback before the print dialog steals focus
        const btn = document.getElementById('download-pdf-btn');
        if (btn) {
            const orig = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span>Preparing…</span>';
            setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1200);
        }
        window.print();
    }

    // Helper Methods
    getQuoteType() {
        if (!this.quoteId) return 'Custom Quote';
        const prefix = this.quoteId.split(/[\d-]/)[0];

        // Check for laser-patch cap orders (EMB prefix with laser-patch embellishment type)
        if (prefix === 'EMB' && this.quoteData?.CapEmbellishmentType === 'laser-patch') {
            return 'Laser Patch';
        }

        // Phase 6 (2026-05-14): CEMB quotes — Type reflects the actual
        // embellishment based on the line item's StyleNumber so reps see
        // "Cap Embroidery" / "Garment Embroidery" / "Full Back Embroidery"
        // instead of generic "Custom Quote". this.items[] is already
        // populated by the time renderQuote() / getQuoteType() runs
        // (loadQuote sets it at line ~117 before render at ~158).
        if (prefix === 'CEMB' && this.items && this.items.length > 0) {
            const style = this.items[0].StyleNumber || '';
            if (style === 'CTR-Cap')                       return 'Cap Embroidery';
            if (style === 'CTR-Garmt')                     return 'Garment Embroidery';
            if (style === 'DECG-FB' || style === 'CTR-FB') return 'Full Back Embroidery';
            return 'Contract Embroidery';
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

    // ShopWorks/ManageOrders CALENDAR dates (req-ship, drop-dead, order ship date)
    // arrive as 'YYYY-MM-DDT00:00:00.000Z' — a calendar day stamped at UTC midnight.
    // formatDate() runs that through new Date() + local time, which shifts it a day
    // back in Pacific (a 6/19 req-ship rendered "June 18"). This formats the Y-M-D
    // parts as the literal calendar date so it matches the ShopWorks order screen.
    // Falls back to formatDate for anything that isn't a Y-M-D date. (Erik 2026-06-17)
    formatShopWorksDate(dateString) {
        if (!dateString) return 'N/A';
        const m = String(dateString).match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return this.formatDate(dateString);
        const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Load design thumbnails for quote view (non-blocking, fire-and-forget)
     * Uses direct fetch since quote-view doesn't load DesignThumbnailService
     */
    _loadQuoteViewThumbnails(garmentDesign, capDesign) {
        const designs = [];
        if (garmentDesign && /^\d+$/.test(String(garmentDesign).trim())) {
            designs.push(String(garmentDesign).trim());
        }
        if (capDesign && /^\d+$/.test(String(capDesign).trim()) && capDesign !== garmentDesign) {
            designs.push(String(capDesign).trim());
        }
        if (designs.length === 0) return;

        const url = `${this.apiBaseUrl}/api/thumbnails/by-designs?ids=${designs.join(',')}`;
        fetch(url)
            .then(resp => {
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return resp.json();
            })
            .then(data => {
                const thumbnails = data.thumbnails || {};
                // Garment thumbnail
                if (garmentDesign && thumbnails[String(garmentDesign).trim()]) {
                    const entry = thumbnails[String(garmentDesign).trim()];
                    if (entry.found && entry.imageUrl) {
                        this._showQuoteViewThumb('qv-garment-thumb', entry.imageUrl);
                    }
                }
                // Cap thumbnail
                if (capDesign && capDesign !== garmentDesign && thumbnails[String(capDesign).trim()]) {
                    const entry = thumbnails[String(capDesign).trim()];
                    if (entry.found && entry.imageUrl) {
                        this._showQuoteViewThumb('qv-cap-thumb', entry.imageUrl);
                    }
                }
            })
            .catch(err => {
                console.warn('[QuoteView] Thumbnail fetch failed:', err.message);
            });
    }

    /**
     * Show a thumbnail image in a quote view span element
     */
    _showQuoteViewThumb(spanId, imageUrl) {
        const span = document.getElementById(spanId);
        if (!span) return;
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Design preview';
        img.className = 'quote-view-design-thumb';
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid #e5e7eb';
        img.style.cursor = 'pointer';
        img.onerror = () => { span.style.display = 'none'; };
        img.onclick = () => {
            // Open full-size in overlay
            const overlay = document.createElement('div');
            overlay.className = 'thumb-modal-overlay';
            overlay.innerHTML = `<img src="${this.escapeHtml(imageUrl)}" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">`;
            overlay.onclick = () => overlay.remove();
            document.body.appendChild(overlay);
        };
        span.innerHTML = '';
        span.appendChild(img);
        span.style.display = 'inline-block';
    }

    getTrackingLink(carrier, trackingNumber) {
        if (!trackingNumber) return '';
        const c = (carrier || '').toUpperCase();
        if (c.includes('UPS')) return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
        if (c.includes('FEDEX') || c.includes('FED EX')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
        if (c.includes('USPS')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
        return '';
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
        // Defense-in-depth: pricing internals must never print in a customer's console
        if (!QV_DEBUG) return;
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
        const taxRate = this.taxRate ?? 0.102;
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

    // =====================================================
    // Push to ShopWorks (Staff Only)
    // =====================================================

    /**
     * Setup the Push to ShopWorks button (staff-only, EMB quotes only)
     */
    /**
     * Per-method push route (expert audit 2026-07-07). All three proxy routes
     * share the same POST contract ({ quoteId, isTest, force }); 'SP' covers the
     * main SCP builder's SP-2026-NNN ids plus legacy SP0707-N and the SPC
     * fast-quote prefix. Returns null for prefixes with no push pipeline.
     */
    _pushRoute() {
        const id = this.quoteId || '';
        if (id.startsWith('EMB')) return { api: '/api/embroidery-push/push-quote', extPrefix: 'NWCA-EMB', itemFilter: (i) => i.EmbellishmentType === 'embroidery' };
        if (id.startsWith('SP')) return { api: '/api/scp-push/push-quote', extPrefix: 'NWCA-SCP', itemFilter: null };
        if (id.startsWith('DTF')) return { api: '/api/dtf-push/push-quote', extPrefix: 'NWCA-DTF', itemFilter: null };
        return null;
    }

    setupPushButton() {
        const btn = document.getElementById('push-shopworks-btn');
        if (!btn) return;

        // Show the button
        btn.style.display = '';

        // If already pushed, show the pushed state
        if (this.quoteData && this.quoteData.PushedToShopWorks) {
            this.setPushButtonPushedState(this.quoteData.PushedToShopWorks);
        }

        // Click handler
        btn.addEventListener('click', () => this.handlePushClick());
    }

    /**
     * Handle push button click — show confirmation, then push
     */
    async handlePushClick() {
        const btn = document.getElementById('push-shopworks-btn');
        if (!btn || btn.disabled) return;

        const route = this._pushRoute();
        if (!route) return;
        const extOrderId = `${route.extPrefix}-${this.quoteId}`;
        const totalAmount = this.quoteData.TotalAmount
            ? `$${parseFloat(this.quoteData.TotalAmount).toFixed(2)}`
            : 'N/A';
        const itemCount = (route.itemFilter ? this.items.filter(route.itemFilter) : this.items).length;

        const confirmed = confirm(
            `Push to ShopWorks?\n\n` +
            `Quote: ${this.quoteId}\n` +
            `Customer: ${this.quoteData.CompanyName || this.quoteData.CustomerName || 'N/A'}\n` +
            `Products: ${itemCount} item(s)\n` +
            `Total: ${totalAmount}\n` +
            `ExtOrderID: ${extOrderId}\n\n` +
            `This will create a new order in ShopWorks OnSite.`
        );

        if (!confirmed) return;

        // Set loading state
        const label = document.getElementById('push-shopworks-label');
        const originalText = label.textContent;
        label.textContent = 'Pushing...';
        btn.disabled = true;
        btn.style.opacity = '0.6';

        try {
            const response = await fetch(`${this.apiBaseUrl}${route.api}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteId: this.quoteId,
                    isTest: false,
                    force: false,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // 409 = already pushed
                if (response.status === 409) {
                    this.setPushButtonPushedState(data.pushedAt);
                    this.showPushToast('Already pushed to ShopWorks', 'info');
                    return;
                }
                throw new Error(data.error || data.details || `HTTP ${response.status}`);
            }

            // Success
            this.setPushButtonPushedState(data.timestamp);
            this.showPushToast(`Pushed to ShopWorks as ${data.extOrderId}`, 'success');

        } catch (error) {
            console.error('[QuoteView] Push error:', error);
            label.textContent = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
            this.showPushToast(`Push failed: ${error.message}`, 'error');
        }
    }

    /**
     * Set the push button to "already pushed" state
     */
    setPushButtonPushedState(timestamp) {
        const btn = document.getElementById('push-shopworks-btn');
        const label = document.getElementById('push-shopworks-label');
        if (!btn || !label) return;

        const dateStr = timestamp ? this.formatDate(timestamp) : '';
        label.textContent = dateStr ? `Pushed ${dateStr}` : 'Pushed';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.background = '#28a745';
        btn.style.color = '#fff';
        btn.style.borderColor = '#28a745';
    }

    /**
     * Show a toast notification for push results
     */
    showPushToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.getElementById('push-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'push-toast';
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            padding: 14px 24px; border-radius: 8px; font-size: 14px;
            color: #fff; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;

        if (type === 'success') toast.style.background = '#28a745';
        else if (type === 'error') toast.style.background = '#dc3545';
        else toast.style.background = '#17a2b8';

        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new QuoteViewPage();
});
