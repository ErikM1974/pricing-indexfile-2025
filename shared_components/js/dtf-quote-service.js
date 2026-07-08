/**
 * DTF Quote Service
 * Handles database operations, quote ID generation, and email functionality
 * for DTF Quote Builder
 *
 * ⚠️ SHARED COMPONENT - USED BY DTF QUOTE BUILDER
 *
 * Key differences from DTG:
 * - Quote prefix: 'DTF' (e.g., DTF0106-1)
 * - Multi-location support stored in Notes JSON
 * - Transfer breakdown by location
 */

class DTFQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.quotePrefix = 'DTF';

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init('4qSbDO-SQs19TbP80');
        }

        console.log('[DTFQuoteService] Service initialized');
    }

    /**
     * Generate unique quote ID using the Caspio-backed sequence counter
     * (format DTF-2026-001; resets annually, persists across sessions/browsers).
     * The old sessionStorage daily counter restarted at 1 in every browser, so
     * two reps (or two tabs) could mint the SAME QuoteID on the same day.
     * The proxy's buildExtOrderID handles the year-led tail unchanged. (2026-06-11)
     */
    async generateQuoteID() {
        try {
            const response = await fetch(`${this.baseURL}/quote-sequence/${this.quotePrefix}`);
            if (!response.ok) throw new Error(`API returned ${response.status}`);
            const { prefix, year, sequence } = await response.json();
            return `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
        } catch (error) {
            // Visible fallback (Erik's #1 rule) — random suffix, NOT a per-browser counter
            console.warn('[DTFQuoteService] Quote sequence API failed, using fallback:', error);
            if (typeof showToast === 'function') {
                showToast('Quote numbering service unreachable — using a temporary quote # (format DTFmmdd-nnnn).', 'warning', 6000);
            }
            const now = new Date();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const sequence = Math.floor(Math.random() * 9000) + 1000;
            return `${this.quotePrefix}${month}${day}-${sequence}`;
        }
    }

    /**
     * Generate unique Session ID
     */
    generateSessionID() {
        return `dtf_quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // cleanupOldSequences() REMOVED 2026-06-11 — only served the retired
    // sessionStorage quote-id counter.

    /**
     * Format date for Caspio (remove milliseconds)
     */
    formatDateForCaspio(date) {
        return date.toISOString().replace(/\.\d{3}Z$/, '');
    }

    /**
     * Format location codes for storage (e.g., 'LC_FB' for left-chest + full-back)
     */
    formatLocationCodes(selectedLocations) {
        const codeMap = {
            'left-chest': 'LC',
            'right-chest': 'RC',
            'left-sleeve': 'LS',
            'right-sleeve': 'RS',
            'back-of-neck': 'BN',
            'center-front': 'CF',
            'center-back': 'CB',
            'full-front': 'FF',
            'full-back': 'FB'
        };

        return selectedLocations
            .map(loc => codeMap[loc] || loc.toUpperCase())
            .join('_');
    }

    /**
     * Format location names for display
     */
    formatLocationNames(selectedLocations) {
        return selectedLocations
            .map(loc => {
                const locationInfo = window.DTFConfig?.transferLocations?.find(l => l.value === loc);
                return locationInfo?.label || loc;
            })
            .join(' + ');
    }

    /**
     * Order-entry, ship-to, and customer-identity fields shared by saveQuote()
     * and updateQuote(). Field names mirror embroidery-quote-service.js so the
     * DTF push transformer (caspio-pricing-proxy/lib/dtf-push-transformer.js)
     * can build a complete ShopWorks order: real id_Customer, ship-to address,
     * PO #, and requested/drop-dead ship dates. All columns already exist in
     * Quote_Sessions (EMB writes them).
     */
    _orderEntryFields(quoteData) {
        return {
            CustomerNumber: quoteData.customerNumber || '',
            Phone: quoteData.customerPhone || '',
            OrderNumber: quoteData.orderNumber || '',
            PurchaseOrderNumber: quoteData.poNumber || '',
            ShipToAddress: quoteData.shipAddress || '',
            ShipToCity: quoteData.shipCity || '',
            ShipToState: quoteData.shipState || '',
            ShipToZip: quoteData.shipZip || '',
            ShipMethod: quoteData.shipMethod || '',
            // null, never '' — Caspio 400s InvalidInputValue on empty strings in
            // Date/Time fields (live SCP incident 2026-07-07; DTF had the same
            // latent bug). null blanks the field, EMB's proven convention.
            ReqShipDate: quoteData.reqShipDate || null,
            DropDeadDate: quoteData.dropDeadDate || null
        };
    }

    /**
     * Save complete quote to database
     */
    async saveQuote(quoteData) {
        try {
            console.log('[DTFQuoteService] Saving quote:', quoteData);

            const quoteID = quoteData.quoteId || await this.generateQuoteID();  // [2026-06-11] async now (server sequence)
            const sessionID = this.generateSessionID();

            // Calculate expiry date (30 days from now)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            // Format locations for storage
            const locationCodes = this.formatLocationCodes(quoteData.selectedLocations || []);
            const locationNames = this.formatLocationNames(quoteData.selectedLocations || []);

            // Calculate tax
            // [2026-06-08] P0: store PRE-TAX all-in (products + fees − discount + shipping) for BOTH SubtotalAmount
            // + TotalAmount (mirror EMB). The old code double-taxed quoteData.total (already tax-inclusive) at a
            // hardcoded 10.1%, corrupting the /quote + /invoice mirror + ignoring the rep's rate + include-tax toggle.
            // The shared invoice generator applies tax on top from TaxRate.
            const subtotal = parseFloat(quoteData.subtotal.toFixed(2));
            const preTaxAllIn = parseFloat((quoteData.preTaxSubtotal != null ? quoteData.preTaxSubtotal : quoteData.subtotal).toFixed(2));
            // [2026-06-08] polish: TotalAmount/SubtotalAmount now EXCLUDE shipping (matches the rendered line items + a
            // separate SHIP fee row, like SCP) so /invoice shows a Shipping line + foots. Tax (below) STILL uses
            // preTaxAllIn so shipping IS taxed. The /invoice + /quote mirror re-adds shipping via the SHIP row → no double-count.
            const _shipFee = parseFloat(quoteData.shippingFee) || 0;
            const preTaxNoShip = parseFloat((preTaxAllIn - _shipFee).toFixed(2));
            const _realRatePct = parseFloat(quoteData.taxRate);
            const _realRate = (isNaN(_realRatePct) ? 10.1 : _realRatePct) / 100;
            const includeTax = quoteData.includeTax !== false;
            const salesTax = includeTax ? parseFloat((preTaxAllIn * _realRate).toFixed(2)) : 0;

            // Prepare session data
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: preTaxNoShip,
                LTMFeeTotal: parseFloat((quoteData.ltmFee || 0).toFixed(2)),
                TotalAmount: preTaxNoShip,
                Status: 'Open',
                ExpiresAt: this.formatDateForCaspio(expiryDate),
                Notes: JSON.stringify({
                    locations: quoteData.selectedLocations,
                    locationCodes: locationCodes,
                    locationNames: locationNames,
                    locationCount: quoteData.selectedLocations?.length || 0,
                    // [2026-06-11] builder nests pricing snapshot under pricingMetadata —
                    // the old top-level reads were always undefined in saved Notes
                    transferBreakdown: quoteData.pricingMetadata?.transferBreakdown ?? quoteData.transferBreakdown,
                    productCount: quoteData.products.length,
                    tier: quoteData.tierLabel,
                    projectName: quoteData.projectName || '',
                    specialNotes: quoteData.notes || quoteData.specialNotes || '',
                    salesRep: quoteData.salesRep || 'sales@nwcustomapparel.com',
                    marginDenominator: quoteData.pricingMetadata?.marginDenominator ?? quoteData.marginDenominator,
                    laborPerLocation: quoteData.pricingMetadata?.laborCostPerLocation ?? quoteData.laborCostPerLocation,
                    freightPerLocation: quoteData.pricingMetadata?.freightPerTransfer ?? quoteData.freightPerTransfer,
                    // [2026-06-11] ship-to recipient — Quote_Sessions has no ShipToName
                    // column (writing one 500s the save), so it rides in Notes JSON
                    shipToName: quoteData.shipToName || '',
                    // [2026-06-11] persisted for edit-reload restore (no session column)
                    includeTax: quoteData.includeTax !== false,
                    // Phase 9 (2026-05-23) — reference artwork file refs
                    // Phase 11.3 (2026-05-24) — files now carry .placement per file
                    // when rich-mode widget was used; proxy reads them to emit
                    // Designs[].Locations[] for the SW push.
                    referenceArtwork: Array.isArray(quoteData.referenceArtwork) ? quoteData.referenceArtwork : [],
                    // Phase 11.1 (2026-05-24) — picked design # (for SW push to populate Designs[])
                    designNumber: quoteData.designNumber || '',
                    // Phase 11.3 (2026-05-24) — design name for NEW-artwork push.
                    // When set AND referenceArtwork[] non-empty AND no designNumber
                    // picked, the proxy emits a new Designs[] entry with this name
                    // (ShopWorks creates a fresh design record on import).
                    newDesignName: quoteData.newDesignName || ''
                }),
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
                // Sales rep + tax rate (2026-03-23)
                SalesRepEmail: quoteData.salesRep || '',
                TaxRate: Number.isFinite(parseFloat(quoteData.taxRate)) ? parseFloat(quoteData.taxRate) : 10.1,  // [2026-06-08] P0: NOT `|| 10.1` — an exempt/0% quote (rate 0) is falsy and was stored as 10.1, re-taxing via the /quote+/invoice mirror + push GL
                TaxAmount: salesTax,
                IsWholesale: quoteData.isWholesale ? 'Yes' : 'No',  // [2026-06-08] wholesale/reseller → 0 tax; push routes to GL 2203
                // Shipping fee + notes (2026-03-22)
                ShippingFee: parseFloat(quoteData.shippingFee) || 0,
                // Order-entry + ship-to fields for ShopWorks push (mirror EMB)
                ...this._orderEntryFields(quoteData)
            };

            // Save session
            const sessionResponse = await fetch(`${this.baseURL}/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                console.error('[DTFQuoteService] Session save failed:', errorText);
                throw new Error(`Failed to save quote session: ${errorText}`);
            }

            const sessionResult = await sessionResponse.json();
            console.log('[DTFQuoteService] Session saved:', sessionResult);

            // Save items - track failures
            let lineNumber = 1;
            let failedItems = 0;
            let totalItems = 0;
            for (const product of quoteData.products) {
                // Save each size group as separate line item
                if (product.sizeGroups && Array.isArray(product.sizeGroups)) {
                    for (const sizeGroup of product.sizeGroups) {
                        // Use sizeGroup color if available (for extended sizes with different colors)
                        const itemColor = sizeGroup.color || product.color;
                        const itemImageUrl = sizeGroup.imageUrl || product.imageUrl || '';

                        const itemData = {
                            QuoteID: quoteID,
                            LineNumber: lineNumber++,
                            StyleNumber: product.styleNumber,
                            ProductName: `${product.productName} - ${itemColor}`,
                            Color: itemColor,
                            // CATALOG_COLOR chain (2026-06-11): the builder passes catalogColor,
                            // never colorCode — the old read saved '' and the ShopWorks push fell
                            // back to display COLOR_NAME ("Brilliant Orange" vs "BrillOrng"),
                            // the documented two-color-field "Unable to verify" bug class.
                            ColorCode: sizeGroup.catalogColor || product.catalogColor || product.colorCode || '',
                            EmbellishmentType: 'dtf',
                            PrintLocation: locationCodes,
                            PrintLocationName: locationNames,
                            Quantity: parseInt(sizeGroup.quantity),
                            // [2026-06-11] waive-aware (was a hardcoded qty<24 that said Yes
                            // even when the rep waived the fee) + a true pre-LTM base price
                            // (Base==Final and LTMPerUnit==0 made the baked LTM unrecoverable)
                            HasLTM: (parseFloat(quoteData.ltmFee) || 0) > 0 ? 'Yes' : 'No',
                            BaseUnitPrice: parseFloat((sizeGroup.unitPrice - (sizeGroup.pricing?.ltmPerUnit || 0)).toFixed(2)),
                            LTMPerUnit: parseFloat((sizeGroup.pricing?.ltmPerUnit || 0).toFixed(2)),
                            FinalUnitPrice: parseFloat(sizeGroup.unitPrice.toFixed(2)),
                            LineTotal: parseFloat(sizeGroup.total.toFixed(2)),
                            SizeBreakdown: JSON.stringify(sizeGroup.sizes),
                            PricingTier: quoteData.tierLabel,
                            ImageURL: itemImageUrl,
                            AddedAt: this.formatDateForCaspio(new Date())
                        };

                        const itemResponse = await fetch(`${this.baseURL}/quote_items`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(itemData)
                        });

                        totalItems++;
                        if (!itemResponse.ok) {
                            const errorText = await itemResponse.text();
                            console.error('[DTFQuoteService] Item save failed:', errorText);
                            failedItems++;
                        } else {
                            const itemResult = await itemResponse.json();
                            console.log('[DTFQuoteService] Item saved:', itemResult);
                        }
                    }
                } else {
                    // Fallback: save as single line item
                    // Calculate totalQuantity from quantities object if present
                    let totalQty = product.totalQuantity || 0;
                    let sizeBreakdown = product.sizeQuantities || {};

                    if (product.quantities && typeof product.quantities === 'object') {
                        // Sum up all quantities from the size breakdown
                        totalQty = Object.values(product.quantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
                        sizeBreakdown = product.quantities;
                    }

                    // Skip if no quantity
                    if (totalQty === 0) {
                        console.log('[DTFQuoteService] Skipping item with 0 quantity:', product.styleNumber);
                        continue;
                    }

                    // Calculate unit price and line total
                    const baseUnitPrice = parseFloat(product.baseCost || product.unitPrice || 0);
                    const finalUnitPrice = parseFloat(product.unitPrice || product.finalPrice || baseUnitPrice);
                    const lineTotal = product.subtotal || (totalQty * finalUnitPrice);

                    // Construct SanMar image URL from style + color code
                    const colorCode = product.colorCode || product.catalogColor || product.color || '';
                    const cleanColorCode = colorCode.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
                    const imageUrl = product.imageUrl ||
                        (product.styleNumber && cleanColorCode ?
                            `https://cdnm.sanmar.com/imglib/mresjpg/2022/${product.styleNumber}/${product.styleNumber}_${cleanColorCode}_model_front_072022.jpg` :
                            '');

                    console.log('[DTFQuoteService] Fallback item data:', {
                        styleNumber: product.styleNumber,
                        color: product.color,
                        colorCode: cleanColorCode,
                        totalQty,
                        finalUnitPrice,
                        lineTotal,
                        imageUrl
                    });

                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: product.styleNumber,
                        ProductName: `${product.productName || product.description || ''} - ${product.color}`,
                        Color: product.color,
                        ColorCode: colorCode,
                        EmbellishmentType: 'dtf',
                        PrintLocation: locationCodes,
                        PrintLocationName: locationNames,
                        Quantity: totalQty,
                        HasLTM: quoteData.totalQuantity < 24 ? 'Yes' : 'No',
                        BaseUnitPrice: parseFloat(baseUnitPrice.toFixed(2)),
                        LTMPerUnit: 0,
                        FinalUnitPrice: parseFloat(finalUnitPrice.toFixed(2)),
                        LineTotal: parseFloat(lineTotal.toFixed(2)),
                        SizeBreakdown: JSON.stringify(sizeBreakdown),
                        PricingTier: quoteData.tierLabel || '',
                        ImageURL: imageUrl,
                        AddedAt: this.formatDateForCaspio(new Date())
                    };

                    const itemResponse = await fetch(`${this.baseURL}/quote_items`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(itemData)
                    });

                    totalItems++;
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('[DTFQuoteService] Item save failed:', errorText);
                        failedItems++;
                    } else {
                        const itemResult = await itemResponse.json();
                        console.log('[DTFQuoteService] Item saved (fallback):', itemResult);
                    }
                }
            }

            await this._saveShipFeeItem(quoteID, quoteData, lineNumber);  // [2026-06-08] SHIP fee row so /invoice shows + foots shipping (TotalAmount now excludes it)

            console.log('[DTFQuoteService] Quote saved:', quoteID,
                failedItems > 0 ? `(${failedItems} items failed)` : '');

            return {
                success: true,
                quoteID: quoteID,
                expiryDate: expiryDate,
                partialSave: failedItems > 0,
                failedItems: failedItems,
                warning: failedItems > 0 ? `${failedItems} of ${totalItems} items failed to save. Please verify your quote.` : null
            };

        } catch (error) {
            console.error('[DTFQuoteService] Error saving quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // sendQuoteEmail() + generateQuoteHTML() REMOVED 2026-06-11 (dead pipeline:
    // zero callers after the builder's dead emailQuote() was removed; the
    // emailjs.send call was commented out so it never sent; its HTML read
    // product.sizeQuantities/productName/subtotal — fields the builder never
    // produces — and hardcoded a $50 LTM blurb).

    /**
     * Get sales rep name from email
     */
    getSalesRepName(email) {
        const salesReps = {
            'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team',
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            'taylar@nwcustomapparel.com': 'Taylar Hanson',
            'nika@nwcustomapparel.com': 'Nika Lao',
            'taneisha@nwcustomapparel.com': 'Taneisha Clark',
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'bradley@nwcustomapparel.com': 'Bradley Wright',
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'art@nwcustomapparel.com': 'Steve Deland'
        };

        return salesReps[email] || 'Sales Team';
    }

    /**
     * Load quote from database
     */
    async loadQuote(quoteID) {
        try {
            // Load session
            const sessionResponse = await fetch(`${this.baseURL}/quote_sessions?QuoteID=${quoteID}`);
            if (!sessionResponse.ok) {
                throw new Error('Quote not found');
            }

            const sessions = await sessionResponse.json();
            if (!sessions || sessions.length === 0) {
                throw new Error('Quote not found');
            }

            // Defensive: pick the MATCHING quote, not blindly sessions[0] (which
            // loaded the wrong quote before the 2026-06-01 proxy QuoteID-filter fix).
            const session = sessions.find(s => s && s.QuoteID === quoteID) || sessions[0];

            // Load items
            const itemsResponse = await fetch(`${this.baseURL}/quote_items?QuoteID=${quoteID}`);
            const items = await itemsResponse.json();

            return {
                success: true,
                session: session,
                items: items || []
            };

        } catch (error) {
            console.error('[DTFQuoteService] Error loading quote:', error);
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
            console.log('[DTFQuoteService] Updating quote:', quoteID);

            // Get current session to find PK_ID and revision number
            const loadResult = await this.loadQuote(quoteID);
            if (!loadResult.success) {
                throw new Error(`Cannot load existing quote: ${loadResult.error}`);
            }

            const existingSession = loadResult.session;
            const currentRevision = existingSession.RevisionNumber || 1;
            const newRevision = currentRevision + 1;

            // Calculate expiry date (30 days from now)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            // Format locations for storage
            const locationCodes = this.formatLocationCodes(quoteData.selectedLocations || []);
            const locationNames = this.formatLocationNames(quoteData.selectedLocations || []);

            // Calculate tax
            // [2026-06-08] P0: store PRE-TAX all-in (products + fees − discount + shipping) for BOTH SubtotalAmount
            // + TotalAmount (mirror EMB). The old code double-taxed quoteData.total (already tax-inclusive) at a
            // hardcoded 10.1%, corrupting the /quote + /invoice mirror + ignoring the rep's rate + include-tax toggle.
            // The shared invoice generator applies tax on top from TaxRate.
            const subtotal = parseFloat(quoteData.subtotal.toFixed(2));
            const preTaxAllIn = parseFloat((quoteData.preTaxSubtotal != null ? quoteData.preTaxSubtotal : quoteData.subtotal).toFixed(2));
            // [2026-06-08] polish: TotalAmount/SubtotalAmount now EXCLUDE shipping (matches the rendered line items + a
            // separate SHIP fee row, like SCP) so /invoice shows a Shipping line + foots. Tax (below) STILL uses
            // preTaxAllIn so shipping IS taxed. The /invoice + /quote mirror re-adds shipping via the SHIP row → no double-count.
            const _shipFee = parseFloat(quoteData.shippingFee) || 0;
            const preTaxNoShip = parseFloat((preTaxAllIn - _shipFee).toFixed(2));
            const _realRatePct = parseFloat(quoteData.taxRate);
            const _realRate = (isNaN(_realRatePct) ? 10.1 : _realRatePct) / 100;
            const includeTax = quoteData.includeTax !== false;
            const salesTax = includeTax ? parseFloat((preTaxAllIn * _realRate).toFixed(2)) : 0;

            // Prepare updated session data
            const sessionData = {
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                SalesRepEmail: quoteData.salesRep || 'sales@nwcustomapparel.com',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: preTaxNoShip,
                LTMFeeTotal: parseFloat((quoteData.ltmFee || 0).toFixed(2)),
                TotalAmount: preTaxNoShip,
                ExpiresAt: this.formatDateForCaspio(expiryDate),
                Notes: JSON.stringify({
                    locations: quoteData.selectedLocations,
                    locationCodes: locationCodes,
                    locationNames: locationNames,
                    locationCount: quoteData.selectedLocations?.length || 0,
                    // [2026-06-11] builder nests pricing snapshot under pricingMetadata —
                    // the old top-level reads were always undefined in saved Notes
                    transferBreakdown: quoteData.pricingMetadata?.transferBreakdown ?? quoteData.transferBreakdown,
                    productCount: quoteData.products.length,
                    tier: quoteData.tierLabel,
                    projectName: quoteData.projectName || '',
                    specialNotes: quoteData.notes || quoteData.specialNotes || '',
                    salesRep: quoteData.salesRep || 'sales@nwcustomapparel.com',
                    marginDenominator: quoteData.pricingMetadata?.marginDenominator ?? quoteData.marginDenominator,
                    laborPerLocation: quoteData.pricingMetadata?.laborCostPerLocation ?? quoteData.laborCostPerLocation,
                    freightPerLocation: quoteData.pricingMetadata?.freightPerTransfer ?? quoteData.freightPerTransfer,
                    // [2026-06-11] ship-to recipient — Quote_Sessions has no ShipToName
                    // column (writing one 500s the save), so it rides in Notes JSON
                    shipToName: quoteData.shipToName || '',
                    // [2026-06-11] persisted for edit-reload restore (no session column)
                    includeTax: quoteData.includeTax !== false,
                    // Phase 9 (2026-05-23) — reference artwork file refs
                    // Phase 11.3 (2026-05-24) — files now carry .placement per file
                    // when rich-mode widget was used.
                    referenceArtwork: Array.isArray(quoteData.referenceArtwork) ? quoteData.referenceArtwork : [],
                    // Phase 11.1 (2026-05-24) — picked design # (for SW push to populate Designs[])
                    designNumber: quoteData.designNumber || '',
                    // Phase 11.3 (2026-05-24) — design name for NEW-artwork push.
                    newDesignName: quoteData.newDesignName || ''
                }),
                RevisionNumber: newRevision,
                RevisedAt: this.formatDateForCaspio(new Date()),
                RevisedBy: quoteData.salesRep || 'sales@nwcustomapparel.com',
                // LTM display preferences (2026-03-22)
                LTM_Display_Mode: quoteData.ltmDisplayMode || 'builtin',
                LTM_Waived: quoteData.ltmWaived ? true : false,
                // Tax rate (2026-03-23)
                TaxRate: Number.isFinite(parseFloat(quoteData.taxRate)) ? parseFloat(quoteData.taxRate) : 10.1,  // [2026-06-08] P0: NOT `|| 10.1` — an exempt/0% quote (rate 0) is falsy and was stored as 10.1, re-taxing via the /quote+/invoice mirror + push GL
                TaxAmount: salesTax,
                IsWholesale: quoteData.isWholesale ? 'Yes' : 'No',  // [2026-06-08] wholesale/reseller → 0 tax; push routes to GL 2203
                // Shipping fee (2026-03-22)
                ShippingFee: parseFloat(quoteData.shippingFee) || 0,
                // Additional charges — must persist on revision too (for ShopWorks push + invoice)
                ArtCharge: parseFloat(quoteData.artCharge?.toFixed?.(2) || quoteData.artCharge) || 0,
                GraphicDesignHours: parseFloat(quoteData.graphicDesignHours) || 0,
                GraphicDesignCharge: parseFloat(quoteData.graphicDesignCharge?.toFixed?.(2) || quoteData.graphicDesignCharge) || 0,
                RushFee: parseFloat(quoteData.rushFee?.toFixed?.(2) || quoteData.rushFee) || 0,
                Discount: parseFloat(quoteData.discount?.toFixed?.(2) || quoteData.discount) || 0,
                DiscountPercent: parseFloat(quoteData.discountPercent) || 0,
                DiscountReason: quoteData.discountReason || '',
                // Order-entry + ship-to fields for ShopWorks push (mirror EMB)
                ...this._orderEntryFields(quoteData)
            };

            // Update session via PUT
            const sessionResponse = await fetch(
                `${this.baseURL}/quote_sessions/${existingSession.PK_ID}`,
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

            // Save new items
            let lineNumber = 1;
            for (const product of quoteData.products) {
                if (product.sizeGroups && Array.isArray(product.sizeGroups)) {
                    for (const sizeGroup of product.sizeGroups) {
                        const itemColor = sizeGroup.color || product.color;
                        const itemImageUrl = sizeGroup.imageUrl || product.imageUrl || '';

                        const itemData = {
                            QuoteID: quoteID,
                            LineNumber: lineNumber++,
                            StyleNumber: product.styleNumber,
                            ProductName: `${product.productName} - ${itemColor}`,
                            Color: itemColor,
                            // CATALOG_COLOR chain (2026-06-11): the builder passes catalogColor,
                            // never colorCode — the old read saved '' and the ShopWorks push fell
                            // back to display COLOR_NAME ("Brilliant Orange" vs "BrillOrng"),
                            // the documented two-color-field "Unable to verify" bug class.
                            ColorCode: sizeGroup.catalogColor || product.catalogColor || product.colorCode || '',
                            EmbellishmentType: 'dtf',
                            PrintLocation: locationCodes,
                            PrintLocationName: locationNames,
                            Quantity: parseInt(sizeGroup.quantity),
                            // [2026-06-11] waive-aware (was a hardcoded qty<24 that said Yes
                            // even when the rep waived the fee) + a true pre-LTM base price
                            // (Base==Final and LTMPerUnit==0 made the baked LTM unrecoverable)
                            HasLTM: (parseFloat(quoteData.ltmFee) || 0) > 0 ? 'Yes' : 'No',
                            BaseUnitPrice: parseFloat((sizeGroup.unitPrice - (sizeGroup.pricing?.ltmPerUnit || 0)).toFixed(2)),
                            LTMPerUnit: parseFloat((sizeGroup.pricing?.ltmPerUnit || 0).toFixed(2)),
                            FinalUnitPrice: parseFloat(sizeGroup.unitPrice.toFixed(2)),
                            LineTotal: parseFloat(sizeGroup.total.toFixed(2)),
                            SizeBreakdown: JSON.stringify(sizeGroup.sizes),
                            PricingTier: quoteData.tierLabel,
                            ImageURL: itemImageUrl,
                            AddedAt: this.formatDateForCaspio(new Date())
                        };

                        const itemResp = await fetch(`${this.baseURL}/quote_items`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(itemData)
                        });
                        // Surface failed inserts — a non-ok POST left the revision
                        // missing lines while the rep saw success. (EMB-parity 2026-06-10)
                        if (!itemResp.ok) {
                            throw new Error(`Line item ${product.styleNumber} failed to save (HTTP ${itemResp.status}) — the revision is incomplete. Try saving again.`);
                        }
                    }
                }
            }

            await this._saveShipFeeItem(quoteID, quoteData, lineNumber);  // [2026-06-08] SHIP fee row so /invoice shows + foots shipping (TotalAmount now excludes it)

            console.log('[DTFQuoteService] Quote updated successfully:', quoteID, 'Rev', newRevision);

            return {
                success: true,
                quoteID: quoteID,
                revision: newRevision
            };

        } catch (error) {
            console.error('[DTFQuoteService] Error updating quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * [2026-06-08] Write a SHIP fee line item so the saved /quote + /invoice mirror shows + foots shipping.
     * getShippingFee() reads EmbellishmentType='fee' & StyleNumber='SHIP'. TotalAmount EXCLUDES shipping (above) and
     * tax is on the shipping-inclusive base, so the mirror's (subtotalNet + SHIP + tax) foots with NO double-count.
     * Mirror of SCP. Called after the product items in BOTH save paths; updateQuote deletes all items first → no dup.
     */
    async _saveShipFeeItem(quoteID, quoteData, lineNumber) {
        const shipFee = parseFloat(quoteData.shippingFee) || 0;
        if (shipFee <= 0) return true;
        try {
            const resp = await fetch(`${this.baseURL}/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    QuoteID: quoteID,
                    // [2026-06-11] caller passes the live item counter — the old
                    // products.length+1 collided with sizeGroup line numbers
                    LineNumber: lineNumber || (quoteData.products?.length || 0) + 1,
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
            // [2026-06-11] a swallowed SHIP-row failure silently dropped shipping
            // (and its tax) from /quote + /invoice — fail loudly instead
            if (!resp.ok) throw new Error(`SHIP item HTTP ${resp.status}`);
            return true;
        } catch (e) {
            console.error('[DTFQuoteService] SHIP fee item save FAILED — saved quote will not show shipping:', e);
            if (typeof showToast === 'function') {
                showToast('Shipping line failed to save — the quote link will be missing shipping. Re-save the quote.', 'error', 8000);
            }
            return false;
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
        const itemsResponse = await fetch(`${this.baseURL}/quote_items?QuoteID=${quoteID}`);
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
                    const resp = await fetch(`${this.baseURL}/quote_items/${item.PK_ID}`, { method: 'DELETE' });
                    if (!resp.ok) { failed++; console.error(`[DTFQuoteService] DELETE item ${item.PK_ID} → HTTP ${resp.status}`); }
                } catch (err) {
                    failed++;
                    console.error(`[DTFQuoteService] DELETE item ${item.PK_ID} failed:`, err);
                }
            }
        }
        if (failed > 0) {
            throw new Error(`${failed} old line item(s) could not be removed — the quote would show duplicated lines. Try saving again.`);
        }

        console.log('[DTFQuoteService] Deleted', items.length, 'existing items');
    }

    /**
     * Generate print-ready quote data
     */
    generatePrintData(quoteData) {
        const locationNames = this.formatLocationNames(quoteData.selectedLocations || []);

        return {
            quoteID: quoteData.quoteID,
            quoteDate: new Date().toLocaleDateString(),
            expiryDate: quoteData.expiryDate?.toLocaleDateString() || '',
            customer: {
                name: quoteData.customerName,
                email: quoteData.customerEmail,
                phone: quoteData.customerPhone,
                company: quoteData.companyName
            },
            locations: locationNames,
            locationCount: quoteData.selectedLocations?.length || 0,
            tierLabel: quoteData.tierLabel,
            totalQuantity: quoteData.totalQuantity,
            products: quoteData.products,
            transferBreakdown: quoteData.transferBreakdown,
            subtotal: quoteData.subtotal,
            ltmFee: quoteData.ltmFee,
            total: quoteData.total,
            hasLTM: quoteData.hasLTM,
            salesRep: this.getSalesRepName(quoteData.salesRep)
        };
    }
}

// Make available globally
window.DTFQuoteService = DTFQuoteService;
