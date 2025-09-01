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
            
            // Build email data
            const emailData = {
                // Email routing
                to_email: customerData.email,
                reply_to: salesRepEmail,
                from_name: 'Northwest Custom Apparel',
                
                // Quote info
                quote_type: 'Embroidery Quote',
                quote_id: quoteData.quoteId,
                quote_date: new Date().toLocaleDateString(),
                
                // Customer info
                customer_name: customerData.name,
                customer_email: customerData.email,
                customer_phone: customerData.phone || '',
                company_name: customerData.company || '',
                project_name: customerData.project || '',
                
                // Pricing
                grand_total: `$${pricingResults.grandTotal.toFixed(2)}`,
                subtotal: `$${pricingResults.subtotal.toFixed(2)}`,
                setup_fees: `$${pricingResults.setupFees.toFixed(2)}`,
                ltm_fee: pricingResults.ltmFee > 0 ? `$${pricingResults.ltmFee.toFixed(2)}` : '',
                
                // Sales rep
                sales_rep_name: salesRep.name,
                sales_rep_email: salesRepEmail,
                sales_rep_phone: '253-922-5793',
                
                // Company
                company_year: '1977',
                
                // Notes
                notes: customerData.notes || 'No special notes for this order',
                
                // HTML content
                quote_details_html: this.generateQuoteHTML(pricingResults)
            };
            
            // Send email
            const result = await emailjs.send(
                'service_1c4k67j',
                'template_embroidery_quote', // You'll need to create this template
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
     * Generate quote HTML for email
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