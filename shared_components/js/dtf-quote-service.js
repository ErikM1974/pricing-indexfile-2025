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
        this.taxRate = 0.101; // 10.1% WA sales tax

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init('4qSbDO-SQs19TbP80');
        }

        console.log('[DTFQuoteService] Service initialized');
    }

    /**
     * Generate unique Quote ID with daily sequence
     * Format: DTF[MMDD]-[sequence]
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

        const quoteID = `${this.quotePrefix}${dateKey}-${sequence}`;
        console.log('[DTFQuoteService] Generated Quote ID:', quoteID);

        return quoteID;
    }

    /**
     * Generate unique Session ID
     */
    generateSessionID() {
        return `dtf_quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
     * Save complete quote to database
     */
    async saveQuote(quoteData) {
        try {
            console.log('[DTFQuoteService] Saving quote:', quoteData);

            const quoteID = quoteData.quoteId || this.generateQuoteID();
            const sessionID = this.generateSessionID();

            // Calculate expiry date (30 days from now)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            // Format locations for storage
            const locationCodes = this.formatLocationCodes(quoteData.selectedLocations || []);
            const locationNames = this.formatLocationNames(quoteData.selectedLocations || []);

            // Calculate tax
            const subtotal = parseFloat(quoteData.subtotal.toFixed(2));
            const salesTax = parseFloat((quoteData.total * this.taxRate).toFixed(2));
            const totalWithTax = parseFloat((quoteData.total + salesTax).toFixed(2));

            // Prepare session data
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: subtotal,
                LTMFeeTotal: parseFloat((quoteData.ltmFee || 0).toFixed(2)),
                TotalAmount: totalWithTax,
                Status: 'Open',
                ExpiresAt: this.formatDateForCaspio(expiryDate),
                Notes: JSON.stringify({
                    locations: quoteData.selectedLocations,
                    locationCodes: locationCodes,
                    locationNames: locationNames,
                    locationCount: quoteData.selectedLocations?.length || 0,
                    transferBreakdown: quoteData.transferBreakdown,
                    productCount: quoteData.products.length,
                    tier: quoteData.tierLabel,
                    projectName: quoteData.projectName || '',
                    specialNotes: quoteData.specialNotes || '',
                    salesRep: quoteData.salesRep || 'sales@nwcustomapparel.com',
                    marginDenominator: quoteData.marginDenominator,
                    laborPerLocation: quoteData.laborCostPerLocation,
                    freightPerLocation: quoteData.freightPerTransfer
                }),
                // Additional charges (2026 fee refactor)
                ArtCharge: parseFloat(quoteData.artCharge?.toFixed?.(2) || quoteData.artCharge) || 0,
                GraphicDesignHours: parseFloat(quoteData.graphicDesignHours) || 0,
                GraphicDesignCharge: parseFloat(quoteData.graphicDesignCharge?.toFixed?.(2) || quoteData.graphicDesignCharge) || 0,
                RushFee: parseFloat(quoteData.rushFee?.toFixed?.(2) || quoteData.rushFee) || 0,
                Discount: parseFloat(quoteData.discount?.toFixed?.(2) || quoteData.discount) || 0,
                DiscountPercent: parseFloat(quoteData.discountPercent) || 0,
                DiscountReason: quoteData.discountReason || ''
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
                            ColorCode: product.colorCode || '',
                            EmbellishmentType: 'dtf',
                            PrintLocation: locationCodes,
                            PrintLocationName: locationNames,
                            Quantity: parseInt(sizeGroup.quantity),
                            HasLTM: quoteData.totalQuantity < 24 ? 'Yes' : 'No',
                            BaseUnitPrice: parseFloat((sizeGroup.effectiveCost || 0).toFixed(2)),
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

    /**
     * Send quote email
     */
    async sendQuoteEmail(quoteData) {
        try {
            console.log('[DTFQuoteService] Preparing email for DTF quote');

            const emailData = {
                // System fields
                to_email: quoteData.customerEmail,
                from_name: 'Northwest Custom Apparel',
                reply_to: quoteData.salesRep || 'sales@nwcustomapparel.com',

                // Quote identification
                quote_type: 'DTF Transfer',
                quote_id: quoteData.quoteID,
                quote_date: new Date().toLocaleDateString(),

                // Customer info
                customer_name: quoteData.customerName,
                customer_email: quoteData.customerEmail,
                company_name: quoteData.companyName || '',
                customer_phone: quoteData.customerPhone || '',

                // Project info
                project_name: quoteData.projectName || '',
                special_notes: quoteData.specialNotes || '',

                // Pricing
                grand_total: `$${quoteData.total.toFixed(2)}`,
                total_quantity: quoteData.totalQuantity,
                pricing_tier: quoteData.tierLabel,

                // Locations
                location_names: this.formatLocationNames(quoteData.selectedLocations || []),
                location_count: quoteData.selectedLocations?.length || 0,

                // Sales rep
                sales_rep_name: this.getSalesRepName(quoteData.salesRep),
                sales_rep_email: quoteData.salesRep || 'sales@nwcustomapparel.com',
                sales_rep_phone: '253-922-5793',

                // Company
                company_year: '1977',

                // Quote details (HTML)
                products_html: this.generateQuoteHTML(quoteData),
                expiry_date: quoteData.expiryDate?.toLocaleDateString() || ''
            };

            console.log('[DTFQuoteService] Email data prepared:', emailData);

            // When EmailJS template is ready, uncomment:
            // await emailjs.send('service_1c4k67j', 'template_dtf_quote', emailData);

            return {
                success: true,
                message: 'Email functionality pending template creation'
            };

        } catch (error) {
            console.error('[DTFQuoteService] Error sending email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate HTML for quote email
     */
    generateQuoteHTML(quoteData) {
        const locationNames = this.formatLocationNames(quoteData.selectedLocations || []);

        let html = `
            <div style="font-family: Arial, sans-serif;">
                <h3 style="color: #10b981;">DTF Transfer Quote</h3>
                <p><strong>Transfer Locations:</strong> ${locationNames}</p>
                <p><strong>Tier:</strong> ${quoteData.tierLabel} (${quoteData.totalQuantity} pieces)</p>

                <h4 style="margin-top: 20px;">Transfer Breakdown</h4>
                <table style="width: auto; border-collapse: collapse; margin: 10px 0;">
                    <tbody>`;

        // Add transfer location costs
        if (quoteData.transferBreakdown?.breakdown) {
            quoteData.transferBreakdown.breakdown.forEach(loc => {
                html += `
                    <tr>
                        <td style="padding: 5px 15px 5px 0;">${loc.locationName}:</td>
                        <td style="padding: 5px;">${loc.sizeName}</td>
                        <td style="padding: 5px; text-align: right;">$${loc.unitCost.toFixed(2)}</td>
                    </tr>`;
            });
        }

        html += `
                    </tbody>
                </table>

                <h4 style="margin-top: 20px;">Products</h4>
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Product</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Unit Price</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Total</th>
                        </tr>
                    </thead>
                    <tbody>`;

        quoteData.products.forEach(product => {
            if (product.sizeGroups && Array.isArray(product.sizeGroups)) {
                product.sizeGroups.forEach(group => {
                    const sizeList = Object.entries(group.sizes || {})
                        .map(([size, qty]) => `${size}(${qty})`)
                        .join(' ');

                    html += `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">
                                ${product.productName} - ${product.color}<br>
                                <small>${sizeList}</small>
                            </td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${group.quantity}</td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${group.unitPrice.toFixed(2)}</td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${group.total.toFixed(2)}</td>
                        </tr>`;
                });
            } else {
                const sizeList = Object.entries(product.sizeQuantities || {})
                    .filter(([size, qty]) => qty > 0)
                    .map(([size, qty]) => `${size}(${qty})`)
                    .join(' ');

                html += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">
                            ${product.productName} - ${product.color}<br>
                            <small>${sizeList || 'N/A'}</small>
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${product.totalQuantity || 0}</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">-</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${(product.subtotal || 0).toFixed(2)}</td>
                    </tr>`;
            }
        });

        html += `
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold;">
                            <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd;">Grand Total:</td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${quoteData.total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>`;

        if (quoteData.totalQuantity < 24) {
            html += `<p style="font-size: 12px; color: #666;">*Orders under 24 pieces include a $50 small batch fee distributed across all pieces</p>`;
        }

        html += `</div>`;

        return html;
    }

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

            const session = sessions[0];

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
            const subtotal = parseFloat(quoteData.subtotal.toFixed(2));
            const salesTax = parseFloat((quoteData.total * this.taxRate).toFixed(2));
            const totalWithTax = parseFloat((quoteData.total + salesTax).toFixed(2));

            // Prepare updated session data
            const sessionData = {
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                SalesRepEmail: quoteData.salesRep || 'sales@nwcustomapparel.com',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: subtotal,
                LTMFeeTotal: parseFloat((quoteData.ltmFee || 0).toFixed(2)),
                TotalAmount: totalWithTax,
                ExpiresAt: this.formatDateForCaspio(expiryDate),
                Notes: JSON.stringify({
                    locations: quoteData.selectedLocations,
                    locationCodes: locationCodes,
                    locationNames: locationNames,
                    locationCount: quoteData.selectedLocations?.length || 0,
                    transferBreakdown: quoteData.transferBreakdown,
                    productCount: quoteData.products.length,
                    tier: quoteData.tierLabel,
                    projectName: quoteData.projectName || '',
                    specialNotes: quoteData.specialNotes || '',
                    salesRep: quoteData.salesRep || 'sales@nwcustomapparel.com',
                    marginDenominator: quoteData.marginDenominator,
                    laborPerLocation: quoteData.laborCostPerLocation,
                    freightPerLocation: quoteData.freightPerTransfer
                }),
                RevisionNumber: newRevision,
                RevisedAt: this.formatDateForCaspio(new Date()),
                RevisedBy: quoteData.salesRep || 'sales@nwcustomapparel.com'
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
                            ColorCode: product.colorCode || '',
                            EmbellishmentType: 'dtf',
                            PrintLocation: locationCodes,
                            PrintLocationName: locationNames,
                            Quantity: parseInt(sizeGroup.quantity),
                            HasLTM: quoteData.totalQuantity < 24 ? 'Yes' : 'No',
                            BaseUnitPrice: parseFloat((sizeGroup.effectiveCost || 0).toFixed(2)),
                            LTMPerUnit: parseFloat((sizeGroup.pricing?.ltmPerUnit || 0).toFixed(2)),
                            FinalUnitPrice: parseFloat(sizeGroup.unitPrice.toFixed(2)),
                            LineTotal: parseFloat(sizeGroup.total.toFixed(2)),
                            SizeBreakdown: JSON.stringify(sizeGroup.sizes),
                            PricingTier: quoteData.tierLabel,
                            ImageURL: itemImageUrl,
                            AddedAt: this.formatDateForCaspio(new Date())
                        };

                        await fetch(`${this.baseURL}/quote_items`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(itemData)
                        });
                    }
                }
            }

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
     * Delete existing quote items for a quote ID
     */
    async deleteExistingItems(quoteID) {
        try {
            // Fetch existing items
            const itemsResponse = await fetch(`${this.baseURL}/quote_items?QuoteID=${quoteID}`);
            if (!itemsResponse.ok) return;

            const items = await itemsResponse.json();
            if (!items || items.length === 0) return;

            // Delete each item
            for (const item of items) {
                if (item.PK_ID) {
                    await fetch(`${this.baseURL}/quote_items/${item.PK_ID}`, {
                        method: 'DELETE'
                    });
                }
            }

            console.log('[DTFQuoteService] Deleted', items.length, 'existing items');
        } catch (error) {
            console.warn('[DTFQuoteService] Error deleting items:', error);
        }
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
