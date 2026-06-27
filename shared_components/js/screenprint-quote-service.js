/**
 * Screen Print Quote Service
 * Handles database operations and quote management for screen print quotes
 */

class ScreenPrintQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'SP';
        this.taxRate = 0.101; // 10.1% WA sales tax
        console.log('[ScreenPrintQuoteService] Initialized');
    }

    /**
     * Generate unique quote ID with date-based sequence
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `${this.quotePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `${this.quotePrefix}${dateKey}-${sequence}`;
    }

    /**
     * Clean up old sequence keys from sessionStorage
     */
    cleanupOldSequences(currentDateKey) {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(`${this.quotePrefix}_quote_sequence_`) && !key.includes(currentDateKey)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }

    /**
     * Generate session ID for quote tracking
     */
    generateSessionID() {
        return `sp_quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save complete quote to database
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[ScreenPrintQuoteService] Saving quote:', quoteID);
            
            // Format expiration date (30 days from now)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');
            
            // Calculate totals
            const subtotal = quoteData.subtotal || quoteData.items.reduce((sum, item) => sum + item.total, 0);
            // Use LTM fee from quoteData (already calculated correctly by quote builder)
            const ltmFeeTotal = quoteData.ltmFee || 0;
            const setupFees = this.calculateSetupFees(quoteData);
            const baseTotal = quoteData.grandTotal || (subtotal + ltmFeeTotal + setupFees);
            // Additional charges (also persisted as separate columns below)
            const artCharge = parseFloat(quoteData.artCharge?.toFixed?.(2) || quoteData.artCharge) || 0;
            const graphicDesignCharge = parseFloat(quoteData.graphicDesignCharge?.toFixed?.(2) || quoteData.graphicDesignCharge) || 0;
            const rushFee = parseFloat(quoteData.rushFee?.toFixed?.(2) || quoteData.rushFee) || 0;
            // Screen-print setup parts (Erik's official list, 2026-06-27) — Vellum +
            // Color Change are additional charges on top of baseTotal (like art/rush),
            // so they MUST be in preTaxTotal or the saved/pushed total under-bills.
            const vellumFee = parseFloat(quoteData.vellumFee) || 0;
            const colorChangeFee = parseFloat(quoteData.colorChangeFee) || 0;
            const discount = parseFloat(quoteData.discount?.toFixed?.(2) || quoteData.discount) || 0;
            // TotalAmount MUST be the PRE-TAX, fee-inclusive subtotal the report expects
            // (quote-view adds shipping + tax on top). The old code stored base*(1+tax)
            // — tax baked in AND art/design/rush/discount dropped — so the report
            // double-taxed it and the saved total was wrong on every SCP quote that
            // used a fee. Mirror EMB (embroidery-quote-service.js). (2026-06-01)
            const preTaxTotal = parseFloat((baseTotal + artCharge + graphicDesignCharge + rushFee + vellumFee + colorChangeFee - discount).toFixed(2));
            const totalAmount = preTaxTotal;
            // TaxAmount is informational (the ShopWorks push note prints it; TaxTotal
            // stays 0). Use the quote's ACTUAL rate (normalized percent→decimal), not
            // the hardcoded service default, so out-of-state rates are honored.
            const rawSaveRate = parseFloat(quoteData.taxRate);
            const taxRateDecimal = !isNaN(rawSaveRate) ? (rawSaveRate > 1 ? rawSaveRate / 100 : rawSaveRate) : this.taxRate;
            // [2026-06-08] P1: WA taxes shipping, and /invoice (invoice.js) TRUSTS this saved TaxAmount verbatim, so the
            // tax base MUST include shipping (preTaxTotal excludes it by design — the mirror adds shipping on top). Without
            // this, /invoice under-charged WA tax on the shipping portion of every SCP quote with shipping. Mirror EMB.
            const _saveShipFee = parseFloat(quoteData.shippingFee) || 0;
            const salesTax = parseFloat(((preTaxTotal + _saveShipFee) * taxRateDecimal).toFixed(2));
            
            // Prepare print setup details for Notes field
            // Include full location details (frontLocation, backLocation, colors) for quote-view.js display
            const printSetup = {
                locations: quoteData.printLocations || [],
                primaryColors: quoteData.primaryColors || 1,
                additionalColors: quoteData.additionalColors || {},
                frontLocation: quoteData.frontLocation || '',
                backLocation: quoteData.backLocation || '',
                frontColors: quoteData.frontColors || 0,
                backColors: quoteData.backColors || 0,
                leftSleeveColors: quoteData.leftSleeveColors || 0,
                rightSleeveColors: quoteData.rightSleeveColors || 0,
                sleeveColorsList: quoteData.sleeveColorsList || quoteData.printSetup?.sleeveColorsList || [],
                totalScreens: quoteData.totalScreens || 0,
                isDarkGarment: quoteData.isDarkGarment || false,
                hasSafetyStripes: quoteData.hasSafetyStripes || false
            };

            // Create session record
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                CustomerNumber: quoteData.customerNumber || '',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: parseFloat(subtotal.toFixed(2)),
                LTMFeeTotal: parseFloat(ltmFeeTotal.toFixed(2)),
                TotalAmount: totalAmount,
                Status: 'Open',
                ExpiresAt: expiresAt,
                Notes: JSON.stringify({
                    ...printSetup,
                    // ShopWorks push reads setupFeeTotal to itemize the SPSU
                    // screen-setup line (screens = setupFeeTotal / $30). Authoritative
                    // $ amount the customer was quoted — avoids re-deriving from colors.
                    setupFeeTotal: setupFees,
                    // Screen-print setup parts (Erik's official list, 2026-06-27). The
                    // SCP push transformer reads these from Notes to synthesize the
                    // Vellum / Color Chg LinesOE. *Total fields are authoritative $ so a
                    // Caspio price change flows through the push.
                    vellumQty: parseInt(quoteData.vellumQty, 10) || 0,
                    vellumTotal: parseFloat(quoteData.vellumFee) || 0,
                    colorChangeQty: parseInt(quoteData.colorChangeQty, 10) || 0,
                    colorChangeTotal: parseFloat(quoteData.colorChangeFee) || 0,
                    userNotes: quoteData.notes || '',
                    // Phase 9 (2026-05-23) — reference artwork file refs
                    // Phase 11.3 (2026-05-24) — files carry .placement per file when
                    // rich-mode widget was used; proxy reads them to emit Locations[].
                    referenceArtwork: Array.isArray(quoteData.referenceArtwork) ? quoteData.referenceArtwork : [],
                    // Phase 11.1 (2026-05-24) — picked design # (for SW push to populate Designs[])
                    designNumber: quoteData.designNumber || '',
                    // Phase 11.3 (2026-05-24) — design name for NEW-artwork push.
                    newDesignName: quoteData.newDesignName || ''
                }),
                // Sales rep (2026-03-23)
                SalesRepEmail: quoteData.salesRep || '',
                // Additional charges (2026 fee refactor)
                ArtCharge: parseFloat(quoteData.artCharge?.toFixed?.(2) || quoteData.artCharge) || 0,
                GraphicDesignHours: parseFloat(quoteData.graphicDesignHours) || 0,
                GraphicDesignCharge: parseFloat(quoteData.graphicDesignCharge?.toFixed?.(2) || quoteData.graphicDesignCharge) || 0,
                RushFee: parseFloat(quoteData.rushFee?.toFixed?.(2) || quoteData.rushFee) || 0,
                Discount: parseFloat(quoteData.discount?.toFixed?.(2) || quoteData.discount) || 0,
                DiscountPercent: parseFloat(quoteData.discountPercent) || 0,
                DiscountReason: quoteData.discountReason || '',
                // LTM display preferences (2026-03-22)
                LTM_Display_Mode: quoteData.ltmDisplayMode || 'builtin',
                LTM_Waived: quoteData.ltmWaived ? true : false,
                // Tax rate (2026-03-23)
                TaxRate: Number.isFinite(parseFloat(quoteData.taxRate)) ? parseFloat(quoteData.taxRate) : 10.1,  // [2026-06-08] P0: NOT `|| 10.1` — an exempt/0% quote (rate 0) is falsy and was stored as 10.1, re-taxing via the /quote+/invoice mirror + push GL
                // Tax amount — informational, drives the ShopWorks push tax note
                // (was never persisted → note always read "$0.00"). (2026-06-01)
                TaxAmount: salesTax,
                IsWholesale: quoteData.isWholesale ? 'Yes' : 'No',  // [2026-06-08] wholesale/reseller → 0 tax; push routes to GL 2203
                // Order & shipping fields (2026-03-22)
                Phone: quoteData.phone || '',
                OrderNumber: quoteData.orderNumber || '',
                PurchaseOrderNumber: quoteData.poNumber || '',
                ShipToAddress: quoteData.shipAddress || '',
                ShipToCity: quoteData.shipCity || '',
                ShipToState: quoteData.shipState || '',
                ShipToZip: quoteData.shipZip || '',
                ShipMethod: quoteData.shipMethod || '',
                ShippingFee: parseFloat(quoteData.shippingFee) || 0,
                ReqShipDate: quoteData.reqShipDate ? this.formatDateForCaspio(new Date(quoteData.reqShipDate + 'T12:00:00')) : '',
                DropDeadDate: quoteData.dropDeadDate ? this.formatDateForCaspio(new Date(quoteData.dropDeadDate + 'T12:00:00')) : ''
            };

            // Save session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });
            
            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                console.error('[ScreenPrintQuoteService] Session save failed:', errorText);
                throw new Error(`Failed to save quote session: ${errorText}`);
            }
            
            const sessionResult = await sessionResponse.json();
            console.log('[ScreenPrintQuoteService] Session saved:', sessionResult);
            
            // Save line items
            const itemPromises = quoteData.items.map(async (item, index) => {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: index + 1,
                    StyleNumber: item.styleNumber || 'CUSTOM',
                    ProductName: item.productName || 'Screen Print Item',
                    Color: item.color || '',
                    ColorCode: item.colorCode || '',
                    EmbellishmentType: 'screenprint',
                    PrintLocation: item.locations ? item.locations.join(', ') : 'Primary',
                    PrintLocationName: this.formatLocationDisplay(item),
                    Quantity: parseInt(item.quantity),
                    HasLTM: (quoteData.ltmFee && quoteData.ltmFee > 0) ? 'Yes' : 'No',
                    BaseUnitPrice: parseFloat(item.basePrice || 0),
                    LTMPerUnit: parseFloat(item.ltmPerUnit || 0),
                    FinalUnitPrice: parseFloat(item.unitPrice || 0),
                    LineTotal: parseFloat(item.lineTotal || 0),
                    SizeBreakdown: JSON.stringify(item.sizeBreakdown || {}),
                    PricingTier: this.getPricingTier(quoteData.totalQuantity),
                    ImageURL: item.imageUrl || '',
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                };
                
                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });
                
                if (!itemResponse.ok) {
                    const errorText = await itemResponse.text();
                    console.error('[ScreenPrintQuoteService] Item save failed:', errorText);
                    // Return false but continue - we'll track failures below
                    return false;
                }

                return true;
            });

            const itemResults = await Promise.all(itemPromises);
            await this._saveShipFeeItem(quoteID, quoteData);  // [2026-06-08] P1: SHIP fee row so the saved mirror shows + taxes shipping
            const failedCount = itemResults.filter(r => !r).length;

            console.log('[ScreenPrintQuoteService] Quote saved:', quoteID,
                failedCount > 0 ? `(${failedCount} items failed)` : '');

            return {
                success: true,
                quoteID: quoteID,
                sessionID: sessionID,
                totalAmount: totalAmount,
                partialSave: failedCount > 0,
                failedItems: failedCount,
                warning: failedCount > 0 ? `${failedCount} of ${itemResults.length} items failed to save. Please verify your quote.` : null
            };
            
        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error saving quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate setup fees based on print setup
     */
    calculateSetupFees(quoteData) {
        // Pricing=API: per-screen setup from Caspio Service_Codes 'SPSU' (fallback $30
        // only when getServicePrice is unavailable). The builder normally passes
        // quoteData.setupFees (already API-priced), so this is the fallback path.
        const screenFeePerColor = (typeof getServicePrice === 'function') ? getServicePrice('SPSU', 30) : 30;

        // Get setup fees from quoteData if already calculated
        if (quoteData.setupFees !== undefined) {
            return quoteData.setupFees;
        }

        // Otherwise calculate from print setup. Prefer the saved totalScreens (front + back + sleeves +
        // dark underbase, already computed by the builder); fall back to the legacy front(+dark) estimate
        // only if it's absent (old quotes).
        let totalScreens = quoteData.printSetup?.totalScreens || quoteData.totalScreens || 0;
        if (!totalScreens) {
            totalScreens = quoteData.printSetup?.frontColors || 1;
            if (quoteData.printSetup?.isDarkGarment) {
                totalScreens += 1;
            }
        }

        return totalScreens * screenFeePerColor;
    }

    /**
     * Format location display for quote items
     */
    formatLocationDisplay(item) {
        if (!item.locations || item.locations.length === 0) {
            return 'Primary Location';
        }
        
        const locationNames = item.locations.map(loc => {
            switch(loc) {
                case 'LC': return 'Left Chest';
                case 'RC': return 'Right Chest';
                case 'FF': return 'Full Front';
                case 'FB': return 'Full Back';
                case 'LS': return 'Left Sleeve';
                case 'RS': return 'Right Sleeve';
                default: return loc;
            }
        });
        
        return locationNames.join(' + ');
    }

    /**
     * Get pricing tier based on quantity
     * Must match screenprint-pricing-v2.js tiers
     */
    getPricingTier(quantity) {
        if (quantity >= 13 && quantity <= 36) return '13-36';
        if (quantity >= 37 && quantity <= 71) return '37-71';
        if (quantity >= 72 && quantity <= 144) return '72-144';
        if (quantity >= 145) return '145-576';
        return '13-36'; // Default to tier 1
    }

    /**
     * Load existing quote by ID
     */
    async loadQuote(quoteID) {
        try {
            // Get session data
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions?QuoteID=${quoteID}`);
            if (!sessionResponse.ok) {
                throw new Error('Quote not found');
            }

            const sessions = await sessionResponse.json();
            if (!sessions || sessions.length === 0) {
                throw new Error('Quote not found');
            }

            // Defensive: the proxy now filters by QuoteID, but if it ever returns
            // extra rows, pick the MATCHING quote — not blindly sessions[0], which
            // loaded the wrong customer/products before the 2026-06-01 proxy fix.
            const session = sessions.find(s => s && s.QuoteID === quoteID) || sessions[0];

            // Get items
            const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?QuoteID=${quoteID}`);
            const items = await itemsResponse.json();

            return {
                success: true,
                session: session,
                items: items || []
            };

        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error loading quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update existing quote (save revision)
     * Keeps same QuoteID, increments revision number
     */
    async updateQuote(quoteID, quoteData) {
        try {
            console.log('[ScreenPrintQuoteService] Updating quote:', quoteID);

            // Get current session to find PK_ID and revision number
            const loadResult = await this.loadQuote(quoteID);
            if (!loadResult.success) {
                throw new Error(`Cannot load existing quote: ${loadResult.error}`);
            }

            const existingSession = loadResult.session;
            const currentRevision = existingSession.RevisionNumber || 1;
            const newRevision = currentRevision + 1;

            // Format expiration date (30 days from now)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');

            // Calculate totals — MUST match saveQuote so editing a quote does not
            // silently change its total. TotalAmount = PRE-TAX, fee-inclusive subtotal
            // (the report adds shipping + tax on top). The old code stored base-only
            // (no fees) while saveQuote stored base+tax → the same quote's total shifted
            // by the tax amount after a no-op revision. (2026-06-01)
            const subtotal = quoteData.subtotal || quoteData.items.reduce((sum, item) => sum + item.total, 0);
            const ltmFeeTotal = quoteData.ltmFee || 0;
            const setupFees = this.calculateSetupFees(quoteData);
            const baseTotal = quoteData.grandTotal || (subtotal + ltmFeeTotal + setupFees);
            const artCharge = parseFloat(quoteData.artCharge?.toFixed?.(2) || quoteData.artCharge) || 0;
            const graphicDesignCharge = parseFloat(quoteData.graphicDesignCharge?.toFixed?.(2) || quoteData.graphicDesignCharge) || 0;
            const rushFee = parseFloat(quoteData.rushFee?.toFixed?.(2) || quoteData.rushFee) || 0;
            // Screen-print setup parts (Erik's official list, 2026-06-27) — see saveQuote.
            const vellumFee = parseFloat(quoteData.vellumFee) || 0;
            const colorChangeFee = parseFloat(quoteData.colorChangeFee) || 0;
            const discount = parseFloat(quoteData.discount?.toFixed?.(2) || quoteData.discount) || 0;
            const totalAmount = parseFloat((baseTotal + artCharge + graphicDesignCharge + rushFee + vellumFee + colorChangeFee - discount).toFixed(2));
            const rawUpdRate = parseFloat(quoteData.taxRate);
            const updTaxRateDecimal = !isNaN(rawUpdRate) ? (rawUpdRate > 1 ? rawUpdRate / 100 : rawUpdRate) : this.taxRate;
            // [2026-06-08] P1: tax base MUST include shipping (WA taxes it; /invoice trusts this saved TaxAmount). Mirror EMB.
            const _updShipFee = parseFloat(quoteData.shippingFee) || 0;
            const salesTax = parseFloat(((totalAmount + _updShipFee) * updTaxRateDecimal).toFixed(2));

            // Prepare print setup details for Notes field
            const printSetup = {
                locations: quoteData.printLocations || [],
                primaryColors: quoteData.primaryColors || 1,
                additionalColors: quoteData.additionalColors || {},
                frontLocation: quoteData.frontLocation,
                backLocation: quoteData.backLocation,
                frontColors: quoteData.frontColors,
                backColors: quoteData.backColors,
                leftSleeveColors: quoteData.leftSleeveColors || 0,
                rightSleeveColors: quoteData.rightSleeveColors || 0,
                sleeveColorsList: quoteData.sleeveColorsList || quoteData.printSetup?.sleeveColorsList || [],
                totalScreens: quoteData.totalScreens || 0,
                isDarkGarment: quoteData.isDarkGarment,
                hasSafetyStripes: quoteData.hasSafetyStripes
            };

            // Prepare updated session data
            const sessionData = {
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                CustomerNumber: quoteData.customerNumber || '',
                SalesRepEmail: quoteData.salesRep || 'sales@nwcustomapparel.com',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: parseFloat(subtotal.toFixed(2)),
                LTMFeeTotal: parseFloat(ltmFeeTotal.toFixed(2)),
                TotalAmount: parseFloat(totalAmount.toFixed(2)),
                ExpiresAt: expiresAt,
                Notes: JSON.stringify({
                    ...printSetup,
                    // ShopWorks push reads setupFeeTotal to itemize the SPSU
                    // screen-setup line (screens = setupFeeTotal / $30). Authoritative
                    // $ amount the customer was quoted — avoids re-deriving from colors.
                    setupFeeTotal: setupFees,
                    // Screen-print setup parts (Erik's official list, 2026-06-27). The
                    // SCP push transformer reads these from Notes to synthesize the
                    // Vellum / Color Chg LinesOE. *Total fields are authoritative $ so a
                    // Caspio price change flows through the push.
                    vellumQty: parseInt(quoteData.vellumQty, 10) || 0,
                    vellumTotal: parseFloat(quoteData.vellumFee) || 0,
                    colorChangeQty: parseInt(quoteData.colorChangeQty, 10) || 0,
                    colorChangeTotal: parseFloat(quoteData.colorChangeFee) || 0,
                    userNotes: quoteData.notes || '',
                    // Phase 9 (2026-05-23) — reference artwork file refs
                    // Phase 11.3 (2026-05-24) — files carry .placement per file when
                    // rich-mode widget was used.
                    referenceArtwork: Array.isArray(quoteData.referenceArtwork) ? quoteData.referenceArtwork : [],
                    // Phase 11.1 (2026-05-24) — picked design # (for SW push to populate Designs[])
                    designNumber: quoteData.designNumber || '',
                    // Phase 11.3 (2026-05-24) — design name for NEW-artwork push.
                    newDesignName: quoteData.newDesignName || ''
                }),
                RevisionNumber: newRevision,
                RevisedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                RevisedBy: quoteData.salesRep || 'sales@nwcustomapparel.com',
                // Additional charges (2026 fee refactor)
                ArtCharge: parseFloat(quoteData.artCharge?.toFixed?.(2) || quoteData.artCharge) || 0,
                GraphicDesignHours: parseFloat(quoteData.graphicDesignHours) || 0,
                GraphicDesignCharge: parseFloat(quoteData.graphicDesignCharge?.toFixed?.(2) || quoteData.graphicDesignCharge) || 0,
                RushFee: parseFloat(quoteData.rushFee?.toFixed?.(2) || quoteData.rushFee) || 0,
                Discount: parseFloat(quoteData.discount?.toFixed?.(2) || quoteData.discount) || 0,
                DiscountPercent: parseFloat(quoteData.discountPercent) || 0,
                DiscountReason: quoteData.discountReason || '',
                // LTM display preferences (2026-03-22)
                LTM_Display_Mode: quoteData.ltmDisplayMode || 'builtin',
                LTM_Waived: quoteData.ltmWaived ? true : false,
                // Tax rate (2026-03-23)
                TaxRate: Number.isFinite(parseFloat(quoteData.taxRate)) ? parseFloat(quoteData.taxRate) : 10.1,  // [2026-06-08] P0: NOT `|| 10.1` — an exempt/0% quote (rate 0) is falsy and was stored as 10.1, re-taxing via the /quote+/invoice mirror + push GL
                // Tax amount — informational, drives the ShopWorks push tax note
                // (was never persisted → note always read "$0.00"). (2026-06-01)
                TaxAmount: salesTax,
                IsWholesale: quoteData.isWholesale ? 'Yes' : 'No',  // [2026-06-08] wholesale/reseller → 0 tax; push routes to GL 2203
                // Order & shipping fields (2026-03-22)
                Phone: quoteData.phone || '',
                OrderNumber: quoteData.orderNumber || '',
                PurchaseOrderNumber: quoteData.poNumber || '',
                ShipToAddress: quoteData.shipAddress || '',
                ShipToCity: quoteData.shipCity || '',
                ShipToState: quoteData.shipState || '',
                ShipToZip: quoteData.shipZip || '',
                ShipMethod: quoteData.shipMethod || '',
                ShippingFee: parseFloat(quoteData.shippingFee) || 0,
                ReqShipDate: quoteData.reqShipDate ? new Date(quoteData.reqShipDate + 'T12:00:00').toISOString().replace(/\.\d{3}Z$/, '') : '',
                DropDeadDate: quoteData.dropDeadDate ? new Date(quoteData.dropDeadDate + 'T12:00:00').toISOString().replace(/\.\d{3}Z$/, '') : ''
            };

            // Update session via PUT
            const sessionResponse = await fetch(
                `${this.baseURL}/api/quote_sessions/${existingSession.PK_ID}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionData)
                }
            );

            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                throw new Error(`Session update failed: ${errorText}`);
            }

            // Delete existing items
            await this.deleteExistingItems(quoteID);

            // Save new line items
            const itemPromises = quoteData.items.map(async (item, index) => {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: index + 1,
                    StyleNumber: item.styleNumber || 'CUSTOM',
                    ProductName: item.productName || 'Screen Print Item',
                    Color: item.color || '',
                    ColorCode: item.colorCode || '',
                    EmbellishmentType: 'screenprint',
                    PrintLocation: item.locations ? item.locations.join(', ') : 'Primary',
                    PrintLocationName: this.formatLocationDisplay(item),
                    Quantity: parseInt(item.quantity),
                    HasLTM: (quoteData.ltmFee && quoteData.ltmFee > 0) ? 'Yes' : 'No',
                    BaseUnitPrice: parseFloat(item.basePrice || 0),
                    LTMPerUnit: parseFloat(item.ltmPerUnit || 0),
                    FinalUnitPrice: parseFloat(item.unitPrice || 0),
                    LineTotal: parseFloat(item.lineTotal || 0),
                    SizeBreakdown: JSON.stringify(item.sizeBreakdown || {}),
                    PricingTier: this.getPricingTier(quoteData.totalQuantity),
                    ImageURL: item.imageUrl || '',
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                };

                return fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });
            });

            // Surface failed inserts — a non-ok POST left the revision missing lines
            // while the rep saw success. (EMB-parity 2026-06-10)
            const itemResponses = await Promise.all(itemPromises);
            const failedInserts = itemResponses.filter(r => !r || !r.ok).length;
            if (failedInserts > 0) {
                throw new Error(`${failedInserts} line item(s) failed to save — the revision is incomplete. Try saving again.`);
            }
            await this._saveShipFeeItem(quoteID, quoteData);  // [2026-06-08] P1: SHIP fee row so the saved mirror shows + taxes shipping

            console.log('[ScreenPrintQuoteService] Quote updated successfully:', quoteID, 'Rev', newRevision);

            return {
                success: true,
                quoteID: quoteID,
                revision: newRevision
            };

        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error updating quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete existing quote items for a quote ID.
     * Failures MUST surface (EMB-parity 2026-06-10): updateQuote deletes first,
     * so a swallowed failure here meant the new inserts piled ON TOP of the old
     * items — doubled lines in the saved quote while the rep saw success.
     */
    async deleteExistingItems(quoteID) {
        // Fetch existing items
        const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?QuoteID=${quoteID}`);
        if (!itemsResponse.ok) {
            throw new Error(`Could not list existing quote items (HTTP ${itemsResponse.status}) — revision not saved. Try again.`);
        }

        const items = await itemsResponse.json();
        if (!items || items.length === 0) return;

        // Delete each item
        let failed = 0;
        for (const item of items) {
            if (item.PK_ID) {
                try {
                    const resp = await fetch(`${this.baseURL}/api/quote_items/${item.PK_ID}`, { method: 'DELETE' });
                    if (!resp.ok) { failed++; console.error(`[ScreenPrintQuoteService] DELETE item ${item.PK_ID} → HTTP ${resp.status}`); }
                } catch (err) {
                    failed++;
                    console.error(`[ScreenPrintQuoteService] DELETE item ${item.PK_ID} failed:`, err);
                }
            }
        }
        if (failed > 0) {
            throw new Error(`${failed} old line item(s) could not be removed — the quote would show duplicated lines. Try saving again.`);
        }

        console.log('[ScreenPrintQuoteService] Deleted', items.length, 'existing items');
    }

    /**
     * [2026-06-08] P1: write a SHIP fee line item so the saved /quote + /invoice mirror shows + taxes shipping.
     * getShippingFee() (quote-view.js + invoice.js) resolves shipping ONLY from EmbellishmentType='fee' &
     * StyleNumber='SHIP'. SCP's TotalAmount stays pre-tax / pre-shipping (the mirror adds shipping on top — see the
     * preTaxTotal comment), so without this row the saved view dropped shipping + its tax (under-charge). Mirror EMB.
     * Called after the product items in BOTH saveQuote + updateQuote; updateQuote deletes all items first so no dup.
     */
    async _saveShipFeeItem(quoteID, quoteData) {
        const shipFee = parseFloat(quoteData.shippingFee) || 0;
        if (shipFee <= 0) return;
        try {
            await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    QuoteID: quoteID,
                    LineNumber: (quoteData.items?.length || 0) + 1,
                    StyleNumber: 'SHIP',
                    ProductName: 'Shipping',
                    EmbellishmentType: 'fee',
                    Quantity: 1,
                    BaseUnitPrice: shipFee,
                    FinalUnitPrice: shipFee,
                    LineTotal: shipFee,
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                })
            });
        } catch (e) {
            console.warn('[ScreenPrintQuoteService] SHIP fee item save failed:', e);
        }
    }

    /**
     * Get recent quotes
     */
    async getRecentQuotes(limit = 10) {
        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions?q.orderBy=CreatedAt DESC&q.limit=${limit}`);
            if (!response.ok) {
                throw new Error('Failed to fetch quotes');
            }
            
            const quotes = await response.json();
            return quotes.filter(q => q.QuoteID && q.QuoteID.startsWith('SP'));
            
        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error fetching quotes:', error);
            return [];
        }
    }
}

// Make service globally available
window.ScreenPrintQuoteService = ScreenPrintQuoteService;