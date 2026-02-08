/**
 * Embroidery Quote Service
 * API and database operations for quote management
 */

class EmbroideryQuoteService {
    constructor() {
        this.baseURL = window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'EMB';
        
        // Staff directory
        this.salesReps = [
            { email: 'sales@nwcustomapparel.com', name: 'General Sales', default: true },
            { email: 'ruth@nwcustomapparel.com', name: 'Ruth Nhong' },
            { email: 'taylar@nwcustomapparel.com', name: 'Taylar Hanson' },
            { email: 'nika@nwcustomapparel.com', name: 'Nika Lao' },
            { email: 'taneisha@nwcustomapparel.com', name: 'Taneisha Clark' },
            { email: 'erik@nwcustomapparel.com', name: 'Erik Mickelson' },
            { email: 'adriyella@nwcustomapparel.com', name: 'Adriyella' },
            { email: 'bradley@nwcustomapparel.com', name: 'Bradley Wright' },
            { email: 'jim@nwcustomapparel.com', name: 'Jim Mickelson' },
            { email: 'art@nwcustomapparel.com', name: 'Steve Deland' }
        ];
        
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
    }

    /**
     * Parse line item description into size breakdown object
     * Example: "S(6) M(6) L(6)" → {"S": 6, "M": 6, "L": 6}
     */
    parseDescriptionToSizeBreakdown(description) {
        const sizeBreakdown = {};
        if (!description) return sizeBreakdown;

        // Match any alphanumeric size pattern followed by (qty)
        // Handles: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL, OSFA, S/M, L/XL, etc.
        const sizeRegex = /([A-Z0-9\/]+)\((\d+)\)/gi;
        let match;
        while ((match = sizeRegex.exec(description)) !== null) {
            const size = match[1].toUpperCase();
            const qty = parseInt(match[2]);
            if (qty > 0) {
                sizeBreakdown[size] = qty;
            }
        }
        return sizeBreakdown;
    }

    /**
     * Generate unique quote ID using Caspio-backed sequence counter
     * Format: EMB-2026-001 (prefix-year-sequence, zero-padded to 3 digits)
     * Resets annually, persists across sessions/browsers
     */
    async generateQuoteID() {
        try {
            const response = await fetch(`${this.baseURL}/api/quote-sequence/${this.quotePrefix}`);
            if (!response.ok) throw new Error(`API returned ${response.status}`);

            const { prefix, year, sequence } = await response.json();
            return `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
        } catch (error) {
            // Fallback to old format if API fails (e.g., Heroku outage)
            console.warn('[EmbroideryQuoteService] Quote sequence API failed, using fallback:', error);
            const now = new Date();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const dateKey = `${month}${day}`;

            // Daily sequence from sessionStorage as fallback
            const storageKey = `${this.quotePrefix}_quote_sequence_${dateKey}`;
            let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
            sessionStorage.setItem(storageKey, sequence.toString());

            return `${this.quotePrefix}${dateKey}-${sequence}`;
        }
    }
    
    /**
     * Generate session ID
     */
    generateSessionID() {
        return `emb_quote_builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Delete all existing items for a quote ID before saving new ones
     * Prevents item accumulation when re-saving a quote
     */
    async deleteExistingItems(quoteID) {
        try {
            // Query existing items
            const response = await fetch(
                `${this.baseURL}/api/quote_items?QuoteID=${encodeURIComponent(quoteID)}`
            );
            if (!response.ok) return; // No items to delete

            const items = await response.json();
            if (!items || !items.length) return;

            // Delete existing items before re-saving

            // Delete items in parallel batches for speed (10 at a time to avoid overwhelming server)
            const batchSize = 10;
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                await Promise.all(
                    batch
                        .filter(item => item.PK_ID)
                        .map(item =>
                            fetch(`${this.baseURL}/api/quote_items/${item.PK_ID}`, {
                                method: 'DELETE'
                            }).catch(err => console.warn(`Failed to delete item ${item.PK_ID}:`, err))
                        )
                );
            }
        } catch (error) {
            console.warn('[EmbroideryQuoteService] Error deleting existing items:', error);
            // Don't throw - allow save to continue
        }
    }

    /**
     * Save complete quote to database
     */
    async saveQuote(quoteData, customerData, pricingResults) {
        try {
            if (!pricingResults.products || pricingResults.products.length === 0) {
                console.warn('[EmbroideryQuoteService] WARNING: No products in pricingResults!');
            }

            const quoteID = await this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            // Format expiration date (30 days from now)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');
            
            // Extract embroidery details from logos for session-level storage
            const primaryLogo = pricingResults.logos?.find(l => l.id === 'primary' || l.isPrimary) || pricingResults.logos?.[0];
            const additionalLogo = pricingResults.logos?.find(l => l.id?.includes('additional') && !l.id?.includes('cap'));
            const capPrimaryLogo = pricingResults.logos?.find(l => l.id === 'cap-primary');

            // Prepare session data
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: customerData.email,
                CustomerName: customerData.name || 'Guest',
                CompanyName: customerData.company || 'Not Provided',
                SalesRepEmail: customerData.salesRepEmail || 'sales@nwcustomapparel.com',
                SalesRepName: customerData.salesRepName || '',
                TotalQuantity: pricingResults.totalQuantity || 0,
                SubtotalAmount: parseFloat(((pricingResults.subtotal || 0) + (pricingResults.ltmFee || 0)).toFixed(2)),
                LTMFeeTotal: parseFloat((pricingResults.ltmFee || 0).toFixed(2)),  // Keep for internal tracking
                // TotalAmount includes ALL fees: grandTotal + Art + GraphicDesign + Rush + Sample - Discount
                // (2026-01-14 fix: Art/Rush/Sample/Discount were missing from TotalAmount)
                TotalAmount: parseFloat((
                    pricingResults.grandTotal +
                    (customerData.artCharge || 0) +
                    (customerData.graphicDesignCharge || 0) +
                    (customerData.rushFee || 0) +
                    (customerData.sampleFee || 0) -
                    (customerData.discount || 0)
                ).toFixed(2)),
                Status: 'Open',
                CreatedAt_Quote: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                ExpiresAt: expiresAt,
                Notes: customerData.notes || '',
                // Embroidery details for easy access by quote view
                PrintLocation: primaryLogo?.position || 'Left Chest',
                StitchCount: primaryLogo?.stitchCount || 8000,
                DigitizingFee: primaryLogo?.needsDigitizing ? 100 : 0,
                AdditionalLogoLocation: additionalLogo?.position || '',
                // Get additional logo stitch count from additionalServices (not logos array)
                AdditionalStitchCount: pricingResults.additionalServices?.find(s => !s.isCap && s.type === 'additional_logo')?.stitchCount || 0,
                // Cap embroidery details
                CapPrintLocation: capPrimaryLogo?.position || '',
                CapStitchCount: capPrimaryLogo?.stitchCount || 0,
                CapDigitizingFee: capPrimaryLogo?.needsDigitizing ? 100 : 0,
                // Cap embellishment type: 'embroidery', '3d-puff', or 'laser-patch'
                CapEmbellishmentType: quoteData.capEmbellishmentType || pricingResults.capEmbellishmentType || 'embroidery',
                // Additional stitch charges - SPLIT by garment/cap per ShopWorks naming (AS-GARM, AS-CAP)
                GarmentStitchCharge: parseFloat(pricingResults.garmentStitchTotal?.toFixed(2)) || 0,
                CapStitchCharge: parseFloat(pricingResults.capStitchTotal?.toFixed(2)) || 0,
                // Keep combined total for backward compatibility
                AdditionalStitchCharge: parseFloat(pricingResults.additionalStitchTotal?.toFixed(2)) || 0,

                // Fee line items for display as separate rows in product table
                // Additional Logo charges (AL)
                ALChargeGarment: parseFloat(pricingResults.additionalServices
                    ?.filter(s => !s.isCap)
                    ?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALChargeCap: parseFloat(pricingResults.additionalServices
                    ?.filter(s => s.isCap)
                    ?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALGarmentQty: pricingResults.garmentQuantity || 0,
                ALCapQty: pricingResults.capQuantity || 0,
                ALGarmentUnitPrice: pricingResults.additionalServices?.find(s => !s.isCap)?.unitPrice || 0,
                ALCapUnitPrice: pricingResults.additionalServices?.find(s => s.isCap)?.unitPrice || 0,
                ALGarmentDesc: pricingResults.additionalServices?.find(s => !s.isCap)?.description || '',
                ALCapDesc: pricingResults.additionalServices?.find(s => s.isCap)?.description || '',
                // Digitizing fees
                GarmentDigitizing: parseFloat(pricingResults.garmentSetupFees?.toFixed(2)) || 0,
                CapDigitizing: parseFloat(pricingResults.capSetupFees?.toFixed(2)) || 0,
                // Extra stitch per-unit price (calculated from total / qty)
                AdditionalStitchUnitPrice: pricingResults.totalQuantity > 0
                    ? parseFloat((pricingResults.additionalStitchTotal / pricingResults.totalQuantity).toFixed(4)) || 0
                    : 0,

                // Extended fee line items (2026-01-14)
                // Art Charge - Logo Mockup & Print Review (GRT-50)
                ArtCharge: parseFloat(customerData.artCharge?.toFixed(2)) || 0,
                // Graphic Design Services (GRT-75) @ $75/hr
                GraphicDesignHours: parseFloat(customerData.graphicDesignHours) || 0,
                GraphicDesignCharge: parseFloat(customerData.graphicDesignCharge?.toFixed(2)) || 0,
                // Rush Fee (expedited processing)
                RushFee: parseFloat(customerData.rushFee?.toFixed(2)) || 0,
                // Sample Fee
                SampleFee: parseFloat(customerData.sampleFee?.toFixed(2)) || 0,
                SampleQty: parseInt(customerData.sampleQty) || 0,
                // LTM baked into per-piece prices — set to 0 so quote-view doesn't render fee rows
                LTM_Garment: 0,
                LTM_Cap: 0,
                // Discount (sales rep discount)
                Discount: parseFloat(customerData.discount?.toFixed(2)) || 0,
                DiscountPercent: parseFloat(customerData.discountPercent) || 0,
                DiscountReason: customerData.discountReason || ''
            };

            // Save session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });
            
            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                throw new Error(`Session save failed: ${errorText}`);
            }

            // Delete any existing items with this QuoteID before saving new ones
            // This prevents item accumulation when re-saving a quote
            await this.deleteExistingItems(quoteID);

            // Save line items for products - track failures
            let lineNumber = 1;
            let failedItems = 0;
            let totalItems = 0;
            let isFirstItem = true;
            for (const productPricing of pricingResults.products) {
                for (const lineItem of productPricing.lineItems) {
                    // Prepare logo specs for the first item only - keep it simple and short
                    let logoSpecsData = '';
                    if (isFirstItem) {
                        try {
                            const specs = {
                                logos: pricingResults.logos.map(l => ({
                                    pos: l.position,
                                    stitch: l.stitchCount,
                                    digit: l.needsDigitizing ? 1 : 0,
                                    primary: l.isPrimary ? 1 : 0
                                })),
                                tier: pricingResults.tier,
                                setup: pricingResults.setupFees
                            };
                            logoSpecsData = JSON.stringify(specs);
                            // Ensure it's not too long for the field
                            if (logoSpecsData.length > 250) {
                                // If too long, just store basic info
                                logoSpecsData = JSON.stringify({
                                    logoCount: pricingResults.logos.length,
                                    tier: pricingResults.tier,
                                    setup: pricingResults.setupFees
                                });
                            }
                        } catch (e) {
                            console.error('Error stringifying logo specs:', e);
                            logoSpecsData = '';
                        }
                    }
                    
                    // If this product has a manual price override, store it in LogoSpecs
                    // (non-first items have empty LogoSpecs, so this doesn't conflict)
                    const hasPriceOverride = productPricing.product.sellPriceOverride > 0;
                    let itemLogoSpecs = logoSpecsData;
                    if (!isFirstItem && hasPriceOverride) {
                        itemLogoSpecs = JSON.stringify({ priceOverride: true, overridePrice: productPricing.product.sellPriceOverride });
                    } else if (isFirstItem && hasPriceOverride) {
                        // First item with override — merge override flag into existing logo specs
                        try {
                            const parsed = logoSpecsData ? JSON.parse(logoSpecsData) : {};
                            parsed.priceOverride = true;
                            parsed.overridePrice = productPricing.product.sellPriceOverride;
                            itemLogoSpecs = JSON.stringify(parsed);
                        } catch (e) {
                            itemLogoSpecs = JSON.stringify({ priceOverride: true, overridePrice: productPricing.product.sellPriceOverride });
                        }
                    }

                    // Check for per-size price overrides (child row overrides)
                    const sizeOverrides = productPricing.product.sizeOverrides || {};
                    const lineItemSizes = Object.keys(this.parseDescriptionToSizeBreakdown(lineItem.description));
                    const sizeOverridePrice = lineItemSizes.length === 1 ? sizeOverrides[lineItemSizes[0]] : null;
                    if (sizeOverridePrice > 0 && !hasPriceOverride) {
                        // Store per-size override in LogoSpecs (separate from parent override)
                        try {
                            const parsed = itemLogoSpecs ? JSON.parse(itemLogoSpecs) : {};
                            parsed.priceOverride = true;
                            parsed.overridePrice = sizeOverridePrice;
                            parsed.sizeOverride = true;
                            itemLogoSpecs = JSON.stringify(parsed);
                        } catch (e) {
                            itemLogoSpecs = JSON.stringify({ priceOverride: true, overridePrice: sizeOverridePrice, sizeOverride: true });
                        }
                    }

                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: productPricing.product.style,
                        ProductName: `${productPricing.product.title} - ${productPricing.product.color}`,
                        Color: productPricing.product.color,
                        ColorCode: productPricing.product.colorCode || productPricing.product.catalogColor || '',
                        EmbellishmentType: 'embroidery',
                        PrintLocation: pricingResults.logos.map(l => l.positionCode || l.position).join('_'),
                        PrintLocationName: pricingResults.logos.map(l => l.position).join(' + '),
                        Quantity: lineItem.quantity,
                        HasLTM: pricingResults.ltmFee > 0 ? 'Yes' : 'No',
                        // LTM baked into per-piece prices (2026-02-06)
                        BaseUnitPrice: parseFloat((lineItem.unitPriceWithLTM || lineItem.basePrice || lineItem.unitPrice).toFixed(2)),
                        LTMPerUnit: parseFloat((lineItem.ltmPerUnit || 0).toFixed(2)),  // Keep for internal tracking
                        FinalUnitPrice: parseFloat((lineItem.unitPriceWithLTM || lineItem.unitPrice).toFixed(2)),
                        LineTotal: parseFloat(((lineItem.unitPriceWithLTM || lineItem.unitPrice) * lineItem.quantity).toFixed(2)),
                        SizeBreakdown: JSON.stringify(this.parseDescriptionToSizeBreakdown(lineItem.description)),  // Parse sizes from description
                        PricingTier: pricingResults.tier,
                        ImageURL: productPricing.product.imageUrl || '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                        LogoSpecs: itemLogoSpecs  // Already a string or empty
                    };

                    const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });

                    totalItems++;
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('Item save failed for line', lineNumber - 1, 'Error:', errorText);
                        console.error('Failed item data:', itemData);
                        failedItems++;
                    }

                    isFirstItem = false;  // Only store logo specs in the first item
                }
            }
            
            // Save additional services as line items
            if (pricingResults.additionalServices && pricingResults.additionalServices.length > 0) {
                for (const service of pricingResults.additionalServices) {
                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: service.partNumber,  // Use ShopWorks part number
                        ProductName: service.description,
                        Color: '',
                        ColorCode: '',
                        EmbellishmentType: service.type === 'monogram' ? 'monogram' : 'embroidery-additional',
                        PrintLocation: service.location || '',
                        PrintLocationName: service.location || '',
                        Quantity: service.quantity,
                        HasLTM: 'No',  // Additional services don't have LTM
                        BaseUnitPrice: parseFloat(service.unitPrice.toFixed(2)),
                        LTMPerUnit: 0,
                        FinalUnitPrice: parseFloat(service.unitPrice.toFixed(2)),
                        LineTotal: parseFloat(service.total.toFixed(2)),
                        SizeBreakdown: JSON.stringify(service.metadata || {}),
                        PricingTier: service.hasSubsetUpcharge ? 'Subset' : pricingResults.tier,
                        ImageURL: '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                        LogoSpecs: ''  // Additional services don't need logo specs
                    };

                    const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });

                    totalItems++;
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('Additional service save failed for line', lineNumber - 1, 'Error:', errorText);
                        console.error('Failed service data:', itemData);
                        failedItems++;
                    }
                }
            }

            // Save DECG/DECC (Customer-Supplied items) as line items
            if (pricingResults.decgItems && pricingResults.decgItems.length > 0) {
                for (const decgItem of pricingResults.decgItems) {
                    const isDECC = decgItem.type === 'DECC';
                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: decgItem.type,  // DECG or DECC
                        ProductName: isDECC ? 'Customer-Supplied Caps' : 'Customer-Supplied Garments',
                        Color: '',
                        ColorCode: '',
                        EmbellishmentType: 'customer-supplied',
                        PrintLocation: '',
                        PrintLocationName: '',
                        Quantity: decgItem.quantity,
                        HasLTM: 'No',
                        BaseUnitPrice: parseFloat(decgItem.unitPrice.toFixed(2)),
                        LTMPerUnit: 0,
                        FinalUnitPrice: parseFloat(decgItem.unitPrice.toFixed(2)),
                        LineTotal: parseFloat(decgItem.total.toFixed(2)),
                        SizeBreakdown: JSON.stringify({ type: decgItem.type }),
                        PricingTier: pricingResults.tier || '',
                        ImageURL: '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                        LogoSpecs: decgItem.hasPriceOverride ? JSON.stringify({ priceOverride: true, overridePrice: decgItem.unitPrice }) : ''
                    };

                    const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });

                    totalItems++;
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('DECG/DECC item save failed for line', lineNumber - 1, 'Error:', errorText);
                        failedItems++;
                    }
                }
            }

            // Save fee/charge items as line items (ShopWorks part numbers)
            const feeResult = await this._saveFeeLineItems(quoteID, lineNumber, sessionData, pricingResults);
            lineNumber = feeResult.lineNumber;
            totalItems += feeResult.totalItems;
            failedItems += feeResult.failedItems;

            if (failedItems > 0) {
                console.warn(`[EmbroideryQuoteService] Quote saved with ${failedItems} failed items:`, quoteID);
            }

            return {
                success: true,
                quoteID: quoteID,
                partialSave: failedItems > 0,
                failedItems: failedItems,
                warning: failedItems > 0 ? `${failedItems} of ${totalItems} items failed to save. Please verify your quote.` : null
            };
            
        } catch (error) {
            console.error('[EmbroideryQuoteService] Save error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Save fee/charge items as quote_items with ShopWorks part numbers.
     * Called by both saveQuote() and updateQuote() to avoid duplication.
     * Only saves fees with non-zero values.
     */
    async _saveFeeLineItems(quoteID, startLineNumber, sessionData, pricingResults) {
        let lineNumber = startLineNumber;
        let failedItems = 0;
        let totalItems = 0;
        const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');

        // Build fee items array — only include non-zero fees
        const feeItems = [];

        // Extra stitches - garment (AS-GARM)
        if (sessionData.GarmentStitchCharge > 0) {
            const garmentQty = pricingResults.garmentQuantity || 0;
            const unitPrice = garmentQty > 0 ? parseFloat((sessionData.GarmentStitchCharge / garmentQty).toFixed(4)) : sessionData.GarmentStitchCharge;
            feeItems.push({
                StyleNumber: 'AS-GARM',
                ProductName: 'Extra Stitches - Garments',
                Quantity: garmentQty || 1,
                BaseUnitPrice: unitPrice,
                FinalUnitPrice: unitPrice,
                LineTotal: sessionData.GarmentStitchCharge
            });
        }

        // Extra stitches - cap (AS-CAP)
        if (sessionData.CapStitchCharge > 0) {
            const capQty = pricingResults.capQuantity || 0;
            const unitPrice = capQty > 0 ? parseFloat((sessionData.CapStitchCharge / capQty).toFixed(4)) : sessionData.CapStitchCharge;
            feeItems.push({
                StyleNumber: 'AS-CAP',
                ProductName: 'Extra Stitches - Caps',
                Quantity: capQty || 1,
                BaseUnitPrice: unitPrice,
                FinalUnitPrice: unitPrice,
                LineTotal: sessionData.CapStitchCharge
            });
        }

        // Digitizing - garment (DD)
        if (sessionData.GarmentDigitizing > 0) {
            feeItems.push({
                StyleNumber: 'DD',
                ProductName: 'Digitizing - Garments',
                Quantity: 1,
                BaseUnitPrice: sessionData.GarmentDigitizing,
                FinalUnitPrice: sessionData.GarmentDigitizing,
                LineTotal: sessionData.GarmentDigitizing
            });
        }

        // Digitizing - cap (DD)
        if (sessionData.CapDigitizing > 0) {
            feeItems.push({
                StyleNumber: 'DD',
                ProductName: 'Digitizing - Caps',
                Quantity: 1,
                BaseUnitPrice: sessionData.CapDigitizing,
                FinalUnitPrice: sessionData.CapDigitizing,
                LineTotal: sessionData.CapDigitizing
            });
        }

        // Art/Setup (GRT-50)
        if (sessionData.ArtCharge > 0) {
            feeItems.push({
                StyleNumber: 'GRT-50',
                ProductName: 'Art/Setup Fee',
                Quantity: 1,
                BaseUnitPrice: sessionData.ArtCharge,
                FinalUnitPrice: sessionData.ArtCharge,
                LineTotal: sessionData.ArtCharge
            });
        }

        // Graphic Design (GRT-75)
        if (sessionData.GraphicDesignCharge > 0) {
            feeItems.push({
                StyleNumber: 'GRT-75',
                ProductName: 'Graphic Design Services',
                Quantity: sessionData.GraphicDesignHours || 1,
                BaseUnitPrice: 75,
                FinalUnitPrice: 75,
                LineTotal: sessionData.GraphicDesignCharge
            });
        }

        // Rush (RUSH)
        if (sessionData.RushFee > 0) {
            feeItems.push({
                StyleNumber: 'RUSH',
                ProductName: 'Rush Order Fee',
                Quantity: 1,
                BaseUnitPrice: sessionData.RushFee,
                FinalUnitPrice: sessionData.RushFee,
                LineTotal: sessionData.RushFee
            });
        }

        // Sample (SAMPLE)
        if (sessionData.SampleFee > 0) {
            feeItems.push({
                StyleNumber: 'SAMPLE',
                ProductName: 'Sample Fee',
                Quantity: sessionData.SampleQty || 1,
                BaseUnitPrice: parseFloat(((sessionData.SampleFee) / (sessionData.SampleQty || 1)).toFixed(2)),
                FinalUnitPrice: parseFloat(((sessionData.SampleFee) / (sessionData.SampleQty || 1)).toFixed(2)),
                LineTotal: sessionData.SampleFee
            });
        }

        // LTM fees are now baked into per-piece prices (2026-02-06)
        // No longer saved as separate fee line items

        // Discount (DISCOUNT) — stored as negative
        if (sessionData.Discount > 0) {
            feeItems.push({
                StyleNumber: 'DISCOUNT',
                ProductName: sessionData.DiscountReason
                    ? `Discount - ${sessionData.DiscountReason}`
                    : 'Discount',
                Quantity: 1,
                BaseUnitPrice: -sessionData.Discount,
                FinalUnitPrice: -sessionData.Discount,
                LineTotal: -sessionData.Discount
            });
        }

        // Save each fee item
        for (const fee of feeItems) {
            const itemData = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: fee.StyleNumber,
                ProductName: fee.ProductName,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'fee',
                PrintLocation: '',
                PrintLocationName: '',
                Quantity: fee.Quantity,
                HasLTM: 'No',
                BaseUnitPrice: parseFloat(fee.BaseUnitPrice.toFixed(2)),
                LTMPerUnit: 0,
                FinalUnitPrice: parseFloat(fee.FinalUnitPrice.toFixed(2)),
                LineTotal: parseFloat(fee.LineTotal.toFixed(2)),
                SizeBreakdown: '',
                PricingTier: '',
                ImageURL: '',
                AddedAt: addedAt,
                LogoSpecs: ''
            };

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });

            totalItems++;
            if (!itemResponse.ok) {
                console.error('[EmbroideryQuoteService] Fee item save failed:', fee.StyleNumber);
                failedItems++;
            }
        }

        return { lineNumber, totalItems, failedItems };
    }

    /**
     * Send quote email
     */
    async sendQuoteEmail(quoteData, customerData, pricingResults, salesRepEmail = 'sales@nwcustomapparel.com') {
        try {
            // Get sales rep info
            const salesRep = this.salesReps.find(rep => rep.email === salesRepEmail) || this.salesReps[0];
            
            // Calculate totals with tax
            const subtotalBeforeTax = pricingResults.subtotal + pricingResults.setupFees + (pricingResults.ltmFee || 0) + (pricingResults.additionalServicesTotal || 0);
            const salesTax = subtotalBeforeTax * 0.101; // 10.1% Milton, WA sales tax
            const grandTotalWithTax = subtotalBeforeTax + salesTax;
            
            // Build email data - ALWAYS provide all variables even if empty
            const emailData = {
                // Email routing (these match EmailJS settings)
                customerEmail: customerData.email || '',
                
                // Quote identification
                quoteID: quoteData.quoteId || '',
                currentDate: new Date().toLocaleDateString('en-US'),
                
                // Customer information - ALWAYS provide these even if empty
                customerName: customerData.name || '',
                customerCompany: customerData.company || '',

                // Project details - ALWAYS provide these
                projectName: customerData.project || '',
                salesRepName: salesRep.name || 'General Sales',
                totalQuantity: (pricingResults.totalQuantity || 0).toString(),
                pricingTier: pricingResults.tier || 'Standard',
                
                // Embroidery details HTML
                embroideryDetails: this.generateEmbroideryDetailsHTML(pricingResults) || '',
                
                // Products table HTML (just the rows, not the full table)
                productsTable: this.generateProductsTableHTML(pricingResults) || '',
                
                // Pricing (without $ sign - template adds it)
                subtotal: subtotalBeforeTax.toFixed(2) || '0.00',
                salesTax: salesTax.toFixed(2) || '0.00',
                grandTotal: grandTotalWithTax.toFixed(2) || '0.00',
                
                // Optional notes - use 'none' to hide the section when empty
                specialNotes: customerData.notes ? customerData.notes : 'none',
                
                // Add the full HTML quote as a fallback
                quote_html: this.generateProfessionalQuoteHTML(quoteData, customerData, pricingResults) || '',
                
                // Additional fields that might be expected by template
                companyPhone: '253-922-5793',
                companyEmail: 'sales@nwcustomapparel.com',
                companyAddress: '2025 Freeman Road East, Milton, WA 98354',
                validDays: '30',
                depositPercent: '50',
                productionDays: '14',
                rushDays: '7',
                rushPercent: '25',
                taxRate: '10.1',
                taxLocation: 'Milton, WA',
                companyYear: '1977',
                companyName: 'Northwest Custom Apparel',
                quotationType: 'Embroidery Contract',
                
                // Ensure stitch count info - calculate if not provided
                totalStitches: pricingResults.totalStitches 
                    ? pricingResults.totalStitches.toLocaleString()
                    : (pricingResults.logos?.reduce((sum, logo) => sum + (logo.stitchCount || 0), 0) || 0).toLocaleString(),
                logoCount: (pricingResults.logos?.length || 0).toString()
            };
            
            // Send email
            const result = await emailjs.send(
                'service_1c4k67j',
                'template_3wmw3no', // Embroidery Quote template
                emailData
            );
            
            return { success: true, result: result };
            
        } catch (error) {
            console.error('[EmbroideryQuoteService] Email error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Generate embroidery details HTML for email template
     */
    generateEmbroideryDetailsHTML(pricingResults) {
        if (!pricingResults || !pricingResults.logos) return '';
        
        let html = '';
        pricingResults.logos.forEach(logo => {
            html += `
                <div style="margin: 8px 0;">
                    <span style="color: #4cb354;">✓</span> 
                    <strong>${logo.position}</strong> (${logo.stitchCount.toLocaleString()} stitches)
                    ${logo.needsDigitizing ? '<span style="color: #666; font-style: italic;"> - Includes digitizing</span>' : ''}
                </div>
            `;
        });
        
        return html;
    }
    
    /**
     * Generate products table HTML rows for email template
     */
    generateProductsTableHTML(pricingResults) {
        if (!pricingResults || !pricingResults.products) return '';
        
        // Calculate total additional logo cost per piece (exclude monograms)
        let totalAdditionalLogoCost = 0;
        if (pricingResults.additionalServices && pricingResults.additionalServices.length > 0) {
            // Only sum additional logo services (not monograms)
            totalAdditionalLogoCost = pricingResults.additionalServices
                .filter(service => service.type === 'additional_logo')
                .reduce((sum, service) => sum + service.unitPrice, 0);
        }
        
        let html = '';
        pricingResults.products.forEach(pp => {
            const product = pp.product;
            pp.lineItems.forEach(item => {
                // Consolidate pricing: base + LTM + additional logos
                const basePrice = item.unitPriceWithLTM || item.unitPrice;
                const consolidatedPrice = basePrice + totalAdditionalLogoCost;
                const lineTotal = consolidatedPrice * item.quantity;
                
                html += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">
                            <strong>${product.style} - ${product.color}</strong><br>
                            ${product.title}<br>
                            <span style="color: #666; font-size: 12px;">
                                ${item.description}<br>
                                Includes embroidery
                            </span>
                        </td>
                        <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${item.quantity}</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${consolidatedPrice.toFixed(2)}</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${lineTotal.toFixed(2)}</td>
                    </tr>
                `;
            });
        });
        
        // Don't show additional services as separate lines since they're included in consolidated pricing
        
        return html;
    }
    
    /**
     * Generate complete professional quote HTML
     */
    generateProfessionalQuoteHTML(quoteData, customerData, pricingResults) {
        const currentDate = new Date().toLocaleDateString('en-US');
        const salesRep = this.salesReps.find(rep => rep.email === (customerData.salesRepEmail || 'sales@nwcustomapparel.com')) || this.salesReps[0];
        
        // Calculate totals with tax
        const subtotalBeforeTax = pricingResults.subtotal + pricingResults.setupFees + (pricingResults.ltmFee || 0) + (pricingResults.additionalServicesTotal || 0);
        const salesTax = subtotalBeforeTax * 0.101; // 10.1% Milton, WA sales tax
        const grandTotalWithTax = subtotalBeforeTax + salesTax;
        
        let html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
            <!-- Header with Company Info -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0;">
                <div style="text-align: center;">
                    <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                         alt="Northwest Custom Apparel" 
                         style="max-width: 200px; height: auto; margin-bottom: 10px;">
                    <div style="color: #666; font-size: 14px;">
                        <p style="margin: 5px 0;">2025 Freeman Road East, Milton, WA 98354</p>
                        <p style="margin: 5px 0;">Phone: (253) 922-5793 | sales@nwcustomapparel.com</p>
                    </div>
                </div>
            </div>
            
            <!-- Quote Header -->
            <div style="background: #4cb354; color: white; padding: 15px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">QUOTE</h1>
                <p style="margin: 5px 0; font-size: 18px;">${quoteData.quoteId}</p>
                <p style="margin: 5px 0;">Date: ${currentDate} | Valid for: 30 days</p>
            </div>
            
            <!-- Customer & Project Info -->
            <div style="display: flex; gap: 20px; padding: 20px; background: #f8f9fa;">
                <div style="flex: 1;">
                    <h3 style="color: #4cb354; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase;">Customer Information</h3>
                    <p style="margin: 5px 0; font-weight: bold;">${customerData.name || 'Not provided'}</p>
                    ${customerData.company ? `<p style="margin: 5px 0;">${customerData.company}</p>` : ''}
                    <p style="margin: 5px 0;">${customerData.email || 'Not provided'}</p>
                    ${customerData.phone ? `<p style="margin: 5px 0;">${customerData.phone}</p>` : ''}
                </div>
                <div style="flex: 1;">
                    <h3 style="color: #4cb354; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase;">Project Details</h3>
                    <p style="margin: 5px 0;"><strong>Type:</strong> Embroidery</p>
                    ${customerData.project ? `<p style="margin: 5px 0;"><strong>Project:</strong> ${customerData.project}</p>` : ''}
                    <p style="margin: 5px 0;"><strong>Total Pieces:</strong> ${pricingResults.totalQuantity}</p>
                    <p style="margin: 5px 0;"><strong>Quote Prepared By:</strong> ${salesRep.name}</p>
                </div>
            </div>
            
            <!-- Embroidery Package -->
            <div style="padding: 20px; background: #e8f5e9; margin: 20px 0; border-radius: 8px;">
                <h3 style="color: #4cb354; margin: 0 0 15px 0;">EMBROIDERY SPECIFICATIONS:</h3>
                ${this.generateEmbroideryDetailsHTML(pricingResults)}
            </div>
            
            <!-- Products Table -->
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background: #4cb354; color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">DESCRIPTION</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">QUANTITY</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">UNIT PRICE</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateProductsTableHTML(pricingResults)}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                <strong>Subtotal (${pricingResults.totalQuantity} pieces):</strong>
                            </td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                <strong>$${subtotalBeforeTax.toFixed(2)}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                Milton, WA Sales Tax (10.1%):
                            </td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                $${salesTax.toFixed(2)}
                            </td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd; font-size: 18px;">
                                <strong>GRAND TOTAL:</strong>
                            </td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd; font-size: 18px; color: #4cb354;">
                                <strong>$${grandTotalWithTax.toFixed(2)}</strong>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <!-- Special Notes -->
            ${customerData.notes ? `
                <div style="padding: 20px; background: #fff9c4; margin: 20px; border-radius: 8px;">
                    <h3 style="color: #f9a825; margin: 0 0 10px 0;">Special Notes</h3>
                    <p style="margin: 0; color: #666;">${customerData.notes}</p>
                </div>
            ` : ''}
            
            <!-- Terms & Conditions -->
            <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
                <h3 style="color: #4cb354; margin: 0 0 15px 0;">Terms & Conditions:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #666; line-height: 1.6;">
                    <li>This quote is valid for 30 days from the date of issue</li>
                    <li>50% deposit required to begin production</li>
                    <li>Production time: 14 business days after order and art approval</li>
                    <li>Rush production available (7 business days) - add 25%</li>
                    <li>Prices subject to change based on final artwork requirements</li>
                </ul>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="color: #4cb354; font-weight: bold; margin: 10px 0;">
                        Thank you for choosing Northwest Custom Apparel!
                    </p>
                    <p style="color: #666; font-size: 12px; margin: 5px 0;">
                        Northwest Custom Apparel | Since 1977 | 2025 Freeman Road East, Milton, WA 98354 | (253) 922-5793
                    </p>
                </div>
            </div>
        </div>
        `;
        
        return html;
    }
    
    /**
     * Generate simple quote HTML for legacy compatibility
     */
    generateQuoteHTML(pricingResults) {
        let html = '<div style="font-family: Arial, sans-serif;">';
        
        // Logos section
        html += '<h3>Embroidery Specifications:</h3>';
        html += '<ul>';
        pricingResults.logos.forEach(logo => {
            html += `<li>${logo.position} - ${logo.stitchCount.toLocaleString()} stitches`;
            if (logo.needsDigitizing) html += ' ✓ Digitizing: $100';
            html += '</li>';
        });
        html += '</ul>';
        
        if (pricingResults.ltmFee > 0) {
            html += '<p style="color: #dc3545;"><em>*Includes $50 Less Than Minimum fee for orders of 7 or fewer pieces</em></p>';
        }
        
        // Products section
        html += '<h3>Products:</h3>';
        pricingResults.products.forEach(pp => {
            html += `<div style="margin-bottom: 20px;">`;
            html += `<h4>${pp.product.style} - ${pp.product.color} - ${pp.product.totalQuantity} pieces</h4>`;
            html += `<p>${pp.product.title}</p>`;
            
            pp.lineItems.forEach(item => {
                const price = item.unitPriceWithLTM || item.unitPrice;
                html += `<p>${item.description} @ $${price.toFixed(2)} each = $${item.total.toFixed(2)}</p>`;
            });
            
            html += `<p><strong>Subtotal: $${pp.subtotal.toFixed(2)}</strong></p>`;
            html += `</div>`;
        });
        
        // Additional Services section
        if (pricingResults.additionalServices && pricingResults.additionalServices.length > 0) {
            html += '<h3>Additional Services:</h3>';
            pricingResults.additionalServices.forEach(service => {
                html += `<div style="margin-bottom: 10px;">`;
                html += `<p><strong>${service.description}</strong> (${service.partNumber})</p>`;
                html += `<p>${service.quantity} pieces @ $${service.unitPrice.toFixed(2)} each = $${service.total.toFixed(2)}</p>`;
                if (service.hasSubsetUpcharge) {
                    html += `<p style="font-size: 12px; color: #666;"><em>*Includes $3.00 subset upcharge</em></p>`;
                }
                html += `</div>`;
            });
        }
        
        // Totals
        html += '<hr>';
        html += `<p><strong>Total Quantity: ${pricingResults.totalQuantity} pieces</strong></p>`;
        html += `<p>Products & Primary Embroidery: $${pricingResults.subtotal.toFixed(2)}</p>`;
        if (pricingResults.additionalServicesTotal && pricingResults.additionalServicesTotal > 0) {
            html += `<p>Additional Services: $${pricingResults.additionalServicesTotal.toFixed(2)}</p>`;
        }
        if (pricingResults.setupFees > 0) {
            html += `<p>Setup Fees: $${pricingResults.setupFees.toFixed(2)}</p>`;
        }
        if (pricingResults.ltmFee > 0) {
            html += `<p>Small Batch Fee: $${pricingResults.ltmFee.toFixed(2)}</p>`;
        }
        html += `<p style="font-size: 18px;"><strong>GRAND TOTAL: $${pricingResults.grandTotal.toFixed(2)}</strong></p>`;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Load existing quote for editing
     * Returns session data and all line items
     */
    async loadQuote(quoteId) {
        try {
            // Load quote session and items

            // Fetch session data
            const sessionResponse = await fetch(
                `${this.baseURL}/api/quote_sessions?QuoteID=${encodeURIComponent(quoteId)}`
            );

            if (!sessionResponse.ok) {
                throw new Error(`Failed to load quote session: ${sessionResponse.status}`);
            }

            const sessions = await sessionResponse.json();
            if (!sessions || sessions.length === 0) {
                throw new Error(`Quote not found: ${quoteId}`);
            }

            const session = sessions[0];

            // Fetch line items
            const itemsResponse = await fetch(
                `${this.baseURL}/api/quote_items?QuoteID=${encodeURIComponent(quoteId)}`
            );

            if (!itemsResponse.ok) {
                throw new Error(`Failed to load quote items: ${itemsResponse.status}`);
            }

            const items = await itemsResponse.json();

            return {
                success: true,
                session: session,
                items: items || []
            };

        } catch (error) {
            console.error('[EmbroideryQuoteService] Load quote error:', error);
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
    async updateQuote(quoteId, quoteData, customerData, pricingResults, revisionNotes = '') {
        try {
            // Update existing quote with new data

            // Get current session to find PK_ID and revision number
            const loadResult = await this.loadQuote(quoteId);
            if (!loadResult.success) {
                throw new Error(`Cannot load existing quote: ${loadResult.error}`);
            }

            const existingSession = loadResult.session;
            const currentRevision = existingSession.RevisionNumber || 1;
            const newRevision = currentRevision + 1;

            // Extract embroidery details from logos for session-level storage
            const primaryLogo = pricingResults.logos?.find(l => l.id === 'primary' || l.isPrimary) || pricingResults.logos?.[0];
            const additionalLogo = pricingResults.logos?.find(l => l.id?.includes('additional') && !l.id?.includes('cap'));
            const capPrimaryLogo = pricingResults.logos?.find(l => l.id === 'cap-primary');

            // Prepare updated session data
            const sessionData = {
                CustomerEmail: customerData.email,
                CustomerName: customerData.name || 'Guest',
                CompanyName: customerData.company || 'Not Provided',
                SalesRepEmail: customerData.salesRepEmail || 'sales@nwcustomapparel.com',
                SalesRepName: customerData.salesRepName || '',
                TotalQuantity: pricingResults.totalQuantity || 0,
                SubtotalAmount: parseFloat(((pricingResults.subtotal || 0) + (pricingResults.ltmFee || 0)).toFixed(2)),
                LTMFeeTotal: parseFloat((pricingResults.ltmFee || 0).toFixed(2)),  // Keep for internal tracking
                TotalAmount: parseFloat((
                    pricingResults.grandTotal +
                    (customerData.artCharge || 0) +
                    (customerData.graphicDesignCharge || 0) +
                    (customerData.rushFee || 0) +
                    (customerData.sampleFee || 0) -
                    (customerData.discount || 0)
                ).toFixed(2)),
                Notes: customerData.notes || '',
                // Embroidery details
                PrintLocation: primaryLogo?.position || 'Left Chest',
                StitchCount: primaryLogo?.stitchCount || 8000,
                DigitizingFee: primaryLogo?.needsDigitizing ? 100 : 0,
                AdditionalLogoLocation: additionalLogo?.position || '',
                // Get additional logo stitch count from additionalServices (not logos array)
                AdditionalStitchCount: pricingResults.additionalServices?.find(s => !s.isCap && s.type === 'additional_logo')?.stitchCount || 0,
                CapPrintLocation: capPrimaryLogo?.position || '',
                CapStitchCount: capPrimaryLogo?.stitchCount || 0,
                CapDigitizingFee: capPrimaryLogo?.needsDigitizing ? 100 : 0,
                // Cap embellishment type: 'embroidery', '3d-puff', or 'laser-patch'
                CapEmbellishmentType: quoteData.capEmbellishmentType || pricingResults.capEmbellishmentType || 'embroidery',
                GarmentStitchCharge: parseFloat(pricingResults.garmentStitchTotal?.toFixed(2)) || 0,
                CapStitchCharge: parseFloat(pricingResults.capStitchTotal?.toFixed(2)) || 0,
                AdditionalStitchCharge: parseFloat(pricingResults.additionalStitchTotal?.toFixed(2)) || 0,
                ALChargeGarment: parseFloat(pricingResults.additionalServices
                    ?.filter(s => !s.isCap)
                    ?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALChargeCap: parseFloat(pricingResults.additionalServices
                    ?.filter(s => s.isCap)
                    ?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALGarmentQty: pricingResults.garmentQuantity || 0,
                ALCapQty: pricingResults.capQuantity || 0,
                ALGarmentUnitPrice: pricingResults.additionalServices?.find(s => !s.isCap)?.unitPrice || 0,
                ALCapUnitPrice: pricingResults.additionalServices?.find(s => s.isCap)?.unitPrice || 0,
                ALGarmentDesc: pricingResults.additionalServices?.find(s => !s.isCap)?.description || '',
                ALCapDesc: pricingResults.additionalServices?.find(s => s.isCap)?.description || '',
                GarmentDigitizing: parseFloat(pricingResults.garmentSetupFees?.toFixed(2)) || 0,
                CapDigitizing: parseFloat(pricingResults.capSetupFees?.toFixed(2)) || 0,
                AdditionalStitchUnitPrice: pricingResults.totalQuantity > 0
                    ? parseFloat((pricingResults.additionalStitchTotal / pricingResults.totalQuantity).toFixed(4)) || 0
                    : 0,
                ArtCharge: parseFloat(customerData.artCharge?.toFixed(2)) || 0,
                GraphicDesignHours: parseFloat(customerData.graphicDesignHours) || 0,
                GraphicDesignCharge: parseFloat(customerData.graphicDesignCharge?.toFixed(2)) || 0,
                RushFee: parseFloat(customerData.rushFee?.toFixed(2)) || 0,
                SampleFee: parseFloat(customerData.sampleFee?.toFixed(2)) || 0,
                SampleQty: parseInt(customerData.sampleQty) || 0,
                // LTM baked into per-piece prices — set to 0 so quote-view doesn't render fee rows
                LTM_Garment: 0,
                LTM_Cap: 0,
                Discount: parseFloat(customerData.discount?.toFixed(2)) || 0,
                DiscountPercent: parseFloat(customerData.discountPercent) || 0,
                DiscountReason: customerData.discountReason || '',
                // Revision tracking (fields added to Caspio 2026-01-15)
                RevisionNumber: newRevision,
                RevisedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                RevisedBy: customerData.salesRepEmail || 'sales@nwcustomapparel.com',
                RevisionNotes: revisionNotes
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

            // Delete existing items and save new ones
            await this.deleteExistingItems(quoteId);

            // Save line items (same logic as saveQuote) - track failures
            let lineNumber = 1;
            let failedItems = 0;
            let totalItems = 0;
            let isFirstItem = true;
            for (const productPricing of pricingResults.products) {
                for (const lineItem of productPricing.lineItems) {
                    let logoSpecsData = '';
                    if (isFirstItem) {
                        try {
                            const specs = {
                                logos: pricingResults.logos.map(l => ({
                                    pos: l.position,
                                    stitch: l.stitchCount,
                                    digit: l.needsDigitizing ? 1 : 0,
                                    primary: l.isPrimary ? 1 : 0
                                })),
                                tier: pricingResults.tier,
                                setup: pricingResults.setupFees
                            };
                            logoSpecsData = JSON.stringify(specs);
                            if (logoSpecsData.length > 250) {
                                logoSpecsData = JSON.stringify({
                                    logoCount: pricingResults.logos.length,
                                    tier: pricingResults.tier,
                                    setup: pricingResults.setupFees
                                });
                            }
                        } catch (e) {
                            logoSpecsData = '';
                        }
                    }

                    // If this product has a manual price override, store it in LogoSpecs
                    const hasPriceOverride = productPricing.product.sellPriceOverride > 0;
                    let itemLogoSpecs = logoSpecsData;
                    if (!isFirstItem && hasPriceOverride) {
                        itemLogoSpecs = JSON.stringify({ priceOverride: true, overridePrice: productPricing.product.sellPriceOverride });
                    } else if (isFirstItem && hasPriceOverride) {
                        try {
                            const parsed = logoSpecsData ? JSON.parse(logoSpecsData) : {};
                            parsed.priceOverride = true;
                            parsed.overridePrice = productPricing.product.sellPriceOverride;
                            itemLogoSpecs = JSON.stringify(parsed);
                        } catch (e) {
                            itemLogoSpecs = JSON.stringify({ priceOverride: true, overridePrice: productPricing.product.sellPriceOverride });
                        }
                    }

                    // Check for per-size price overrides (child row overrides)
                    const sizeOverrides = productPricing.product.sizeOverrides || {};
                    const lineItemSizes = Object.keys(this.parseDescriptionToSizeBreakdown(lineItem.description));
                    const sizeOverridePrice = lineItemSizes.length === 1 ? sizeOverrides[lineItemSizes[0]] : null;
                    if (sizeOverridePrice > 0 && !hasPriceOverride) {
                        try {
                            const parsed = itemLogoSpecs ? JSON.parse(itemLogoSpecs) : {};
                            parsed.priceOverride = true;
                            parsed.overridePrice = sizeOverridePrice;
                            parsed.sizeOverride = true;
                            itemLogoSpecs = JSON.stringify(parsed);
                        } catch (e) {
                            itemLogoSpecs = JSON.stringify({ priceOverride: true, overridePrice: sizeOverridePrice, sizeOverride: true });
                        }
                    }

                    const itemData = {
                        QuoteID: quoteId,
                        LineNumber: lineNumber++,
                        StyleNumber: productPricing.product.style,
                        ProductName: `${productPricing.product.title} - ${productPricing.product.color}`,
                        Color: productPricing.product.color,
                        ColorCode: productPricing.product.colorCode || productPricing.product.catalogColor || '',
                        EmbellishmentType: 'embroidery',
                        PrintLocation: pricingResults.logos.map(l => l.positionCode || l.position).join('_'),
                        PrintLocationName: pricingResults.logos.map(l => l.position).join(' + '),
                        Quantity: lineItem.quantity,
                        HasLTM: pricingResults.ltmFee > 0 ? 'Yes' : 'No',
                        // LTM baked into per-piece prices (2026-02-06)
                        BaseUnitPrice: parseFloat((lineItem.unitPriceWithLTM || lineItem.basePrice || lineItem.unitPrice).toFixed(2)),
                        LTMPerUnit: parseFloat((lineItem.ltmPerUnit || 0).toFixed(2)),  // Keep for internal tracking
                        FinalUnitPrice: parseFloat((lineItem.unitPriceWithLTM || lineItem.unitPrice).toFixed(2)),
                        LineTotal: parseFloat(((lineItem.unitPriceWithLTM || lineItem.unitPrice) * lineItem.quantity).toFixed(2)),
                        SizeBreakdown: JSON.stringify(this.parseDescriptionToSizeBreakdown(lineItem.description)),
                        PricingTier: pricingResults.tier,
                        ImageURL: productPricing.product.imageUrl || '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                        LogoSpecs: itemLogoSpecs
                    };

                    totalItems++;
                    const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });

                    if (!itemResponse.ok) {
                        console.error('[EmbroideryQuoteService] Item save failed for line', lineNumber - 1);
                        failedItems++;
                    }

                    isFirstItem = false;
                }
            }

            // Save additional services as line items
            if (pricingResults.additionalServices && pricingResults.additionalServices.length > 0) {
                for (const service of pricingResults.additionalServices) {
                    const itemData = {
                        QuoteID: quoteId,
                        LineNumber: lineNumber++,
                        StyleNumber: service.partNumber,
                        ProductName: service.description,
                        Color: '',
                        ColorCode: '',
                        EmbellishmentType: service.type === 'monogram' ? 'monogram' : 'embroidery-additional',
                        PrintLocation: service.location || '',
                        PrintLocationName: service.location || '',
                        Quantity: service.quantity,
                        HasLTM: 'No',
                        BaseUnitPrice: parseFloat(service.unitPrice.toFixed(2)),
                        LTMPerUnit: 0,
                        FinalUnitPrice: parseFloat(service.unitPrice.toFixed(2)),
                        LineTotal: parseFloat(service.total.toFixed(2)),
                        SizeBreakdown: JSON.stringify(service.metadata || {}),
                        PricingTier: service.hasSubsetUpcharge ? 'Subset' : pricingResults.tier,
                        ImageURL: '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                        LogoSpecs: ''
                    };

                    totalItems++;
                    const serviceResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });

                    if (!serviceResponse.ok) {
                        console.error('[EmbroideryQuoteService] Service save failed for line', lineNumber - 1);
                        failedItems++;
                    }
                }
            }

            // Save DECG/DECC (Customer-Supplied items) as line items
            if (pricingResults.decgItems && pricingResults.decgItems.length > 0) {
                for (const decgItem of pricingResults.decgItems) {
                    const isDECC = decgItem.type === 'DECC';
                    const itemData = {
                        QuoteID: quoteId,
                        LineNumber: lineNumber++,
                        StyleNumber: decgItem.type,  // DECG or DECC
                        ProductName: isDECC ? 'Customer-Supplied Caps' : 'Customer-Supplied Garments',
                        Color: '',
                        ColorCode: '',
                        EmbellishmentType: 'customer-supplied',
                        PrintLocation: '',
                        PrintLocationName: '',
                        Quantity: decgItem.quantity,
                        HasLTM: 'No',
                        BaseUnitPrice: parseFloat(decgItem.unitPrice.toFixed(2)),
                        LTMPerUnit: 0,
                        FinalUnitPrice: parseFloat(decgItem.unitPrice.toFixed(2)),
                        LineTotal: parseFloat(decgItem.total.toFixed(2)),
                        SizeBreakdown: JSON.stringify({ type: decgItem.type }),
                        PricingTier: pricingResults.tier || '',
                        ImageURL: '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                        LogoSpecs: decgItem.hasPriceOverride ? JSON.stringify({ priceOverride: true, overridePrice: decgItem.unitPrice }) : ''
                    };

                    totalItems++;
                    const decgResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });

                    if (!decgResponse.ok) {
                        console.error('[EmbroideryQuoteService] DECG/DECC item save failed for line', lineNumber - 1);
                        failedItems++;
                    }
                }
            }

            // Save fee/charge items as line items (ShopWorks part numbers)
            const feeResult = await this._saveFeeLineItems(quoteId, lineNumber, sessionData, pricingResults);
            lineNumber = feeResult.lineNumber;
            totalItems += feeResult.totalItems;
            failedItems += feeResult.failedItems;

            if (failedItems > 0) {
                console.warn(`[EmbroideryQuoteService] Quote updated with ${failedItems} failed items:`, quoteId);
            }

            return {
                success: true,
                quoteID: quoteId,
                revision: newRevision,
                partialSave: failedItems > 0,
                failedItems: failedItems,
                warning: failedItems > 0 ? `${failedItems} of ${totalItems} items failed to save. Please verify your quote.` : null
            };

        } catch (error) {
            console.error('[EmbroideryQuoteService] Update error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get sales rep name
     */
    getSalesRepName(email) {
        const rep = this.salesReps.find(r => r.email === email);
        return rep ? rep.name : 'Sales Representative';
    }
    
    /**
     * Get all sales reps for dropdown
     */
    getSalesReps() {
        return this.salesReps;
    }
}

// Make available globally
window.EmbroideryQuoteService = EmbroideryQuoteService;