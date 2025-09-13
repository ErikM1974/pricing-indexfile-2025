/**
 * Embroidery Quote Service
 * API and database operations for quote management
 */

class EmbroideryQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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
     * Generate unique quote ID
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset
        const storageKey = `${this.quotePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `${this.quotePrefix}${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up old sequence storage
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith(`${this.quotePrefix}_quote_sequence_`) && !key.includes(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }
    
    /**
     * Generate session ID
     */
    generateSessionID() {
        return `emb_quote_builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Save complete quote to database
     */
    async saveQuote(quoteData, customerData, pricingResults) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            // Format expiration date (30 days from now)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');
            
            // Prepare session data
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: customerData.email,
                CustomerName: customerData.name || 'Guest',
                CompanyName: customerData.company || 'Not Provided',
                Phone: customerData.phone || '',
                SalesRepEmail: customerData.salesRepEmail || 'sales@nwcustomapparel.com',
                TotalQuantity: pricingResults.totalQuantity,
                SubtotalAmount: parseFloat(pricingResults.subtotal.toFixed(2)),
                LTMFeeTotal: parseFloat(pricingResults.ltmFee.toFixed(2)),
                TotalAmount: parseFloat(pricingResults.grandTotal.toFixed(2)),
                Status: 'Open',
                ExpiresAt: expiresAt,
                Notes: customerData.notes || ''
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
            
            // Save line items for products
            let lineNumber = 1;
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
                    
                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: productPricing.product.style,
                        ProductName: `${productPricing.product.title} - ${productPricing.product.color}`,
                        Color: productPricing.product.color,
                        ColorCode: '',
                        EmbellishmentType: 'embroidery',
                        PrintLocation: 'Multiple Logos',
                        PrintLocationName: pricingResults.logos.filter(l => l.isPrimary !== false).map(l => l.position).join(', '),
                        Quantity: lineItem.quantity,
                        HasLTM: pricingResults.ltmFee > 0 ? 'Yes' : 'No',
                        BaseUnitPrice: parseFloat(lineItem.unitPrice.toFixed(2)),
                        LTMPerUnit: parseFloat((pricingResults.ltmPerUnit || 0).toFixed(2)),
                        FinalUnitPrice: parseFloat((lineItem.unitPriceWithLTM || lineItem.unitPrice).toFixed(2)),
                        LineTotal: parseFloat(lineItem.total.toFixed(2)),
                        SizeBreakdown: JSON.stringify(productPricing.product.sizeBreakdown || {}),  // Ensure it's always a valid JSON string
                        PricingTier: pricingResults.tier,
                        ImageURL: productPricing.product.imageUrl || '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                        LogoSpecs: logoSpecsData  // Already a string or empty
                    };
                    
                    const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });
                    
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('Item save failed for line', lineNumber - 1, 'Error:', errorText);
                        console.error('Failed item data:', itemData);
                        // Don't throw - allow partial success
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
                    
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('Additional service save failed for line', lineNumber - 1, 'Error:', errorText);
                        console.error('Failed service data:', itemData);
                        // Don't throw - allow partial success
                    }
                }
            }
            
            console.log('[EmbroideryQuoteService] Quote saved successfully:', quoteID);
            return { success: true, quoteID: quoteID };
            
        } catch (error) {
            console.error('[EmbroideryQuoteService] Save error:', error);
            return { success: false, error: error.message };
        }
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
                customerPhone: customerData.phone || '',
                
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
            
            console.log('[EmbroideryQuoteService] Email data being sent:', emailData);
            
            // Send email
            const result = await emailjs.send(
                'service_1c4k67j',
                'template_3wmw3no', // Embroidery Quote template
                emailData
            );
            
            console.log('[EmbroideryQuoteService] Email sent successfully');
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
        
        // Calculate total additional logo cost per piece
        let totalAdditionalLogoCost = 0;
        if (pricingResults.additionalServices && pricingResults.additionalServices.length > 0) {
            totalAdditionalLogoCost = pricingResults.additionalServices
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
            html += '<p style="color: #dc3545;"><em>*Includes small batch pricing for orders under 24 pieces</em></p>';
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