/**
 * DTG Quote Service
 * Handles database operations, quote ID generation, and email functionality
 * for DTG Quote Builder
 */

class DTGQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.quotePrefix = 'DTG';
        
        // Initialize EmailJS (will be configured when template is created)
        if (typeof emailjs !== 'undefined') {
            emailjs.init('4qSbDO-SQs19TbP80');
        }
        
        console.log('[DTGQuoteService] Service initialized');
    }
    
    /**
     * Generate unique Quote ID with daily sequence
     * Format: DTG[MMDD]-[sequence]
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
        console.log('[DTGQuoteService] Generated Quote ID:', quoteID);
        
        return quoteID;
    }
    
    /**
     * Generate unique Session ID
     */
    generateSessionID() {
        return `dtg_quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
     * Save complete quote to database
     */
    async saveQuote(quoteData) {
        try {
            console.log('[DTGQuoteService] Saving quote:', quoteData);
            
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            // Calculate expiry date (30 days from now)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            
            // Prepare session data
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: parseFloat(quoteData.subtotal.toFixed(2)),
                LTMFeeTotal: parseFloat((quoteData.ltmFee || 0).toFixed(2)),
                TotalAmount: parseFloat(quoteData.total.toFixed(2)),
                Status: 'Open',
                ExpiresAt: this.formatDateForCaspio(expiryDate),
                Notes: JSON.stringify({
                    location: quoteData.location,
                    locationName: quoteData.locationName,
                    productCount: quoteData.products.length,
                    tier: quoteData.tier,
                    projectName: quoteData.projectName || '',
                    specialNotes: quoteData.specialNotes || '',
                    salesRep: quoteData.salesRep || 'sales@nwcustomapparel.com'
                })
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
                console.error('[DTGQuoteService] Session save failed:', errorText);
                throw new Error(`Failed to save quote session: ${errorText}`);
            }
            
            const sessionResult = await sessionResponse.json();
            console.log('[DTGQuoteService] Session saved:', sessionResult);
            
            // Save items
            let lineNumber = 1;
            for (const product of quoteData.products) {
                // Save each size group separately for clarity
                for (const sizeGroup of product.sizeGroups) {
                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: product.styleNumber,
                        ProductName: `${product.productName} - ${product.color}`,
                        Color: product.color,
                        ColorCode: product.colorCode || '',
                        EmbellishmentType: 'dtg',
                        PrintLocation: quoteData.location,
                        PrintLocationName: quoteData.locationName,
                        Quantity: parseInt(sizeGroup.quantity),
                        HasLTM: quoteData.totalQuantity < 24 ? 'Yes' : 'No',
                        BaseUnitPrice: parseFloat(sizeGroup.basePrice.toFixed(2)),
                        LTMPerUnit: parseFloat((sizeGroup.ltmPerUnit || 0).toFixed(2)),
                        FinalUnitPrice: parseFloat(sizeGroup.unitPrice.toFixed(2)),
                        LineTotal: parseFloat(sizeGroup.total.toFixed(2)),
                        SizeBreakdown: JSON.stringify(sizeGroup.sizes),
                        PricingTier: quoteData.tier,
                        ImageURL: product.imageUrl || '',
                        AddedAt: this.formatDateForCaspio(new Date())
                    };
                    
                    const itemResponse = await fetch(`${this.baseURL}/quote_items`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(itemData)
                    });
                    
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('[DTGQuoteService] Item save failed:', errorText);
                        // Continue saving other items even if one fails
                    } else {
                        const itemResult = await itemResponse.json();
                        console.log('[DTGQuoteService] Item saved:', itemResult);
                    }
                }
            }
            
            console.log('[DTGQuoteService] Quote saved successfully:', quoteID);
            
            return {
                success: true,
                quoteID: quoteID,
                expiryDate: expiryDate
            };
            
        } catch (error) {
            console.error('[DTGQuoteService] Error saving quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Send quote email (placeholder for when EmailJS template is ready)
     */
    async sendQuoteEmail(quoteData) {
        try {
            console.log('[DTGQuoteService] Email functionality will be implemented when template is created');
            
            // Prepare email data structure for future use
            const emailData = {
                // System fields
                to_email: quoteData.customerEmail,
                from_name: 'Northwest Custom Apparel',
                reply_to: quoteData.salesRep || 'sales@nwcustomapparel.com',
                
                // Quote identification
                quote_type: 'DTG Print',
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
                pricing_tier: quoteData.tier,
                
                // Sales rep
                sales_rep_name: this.getSalesRepName(quoteData.salesRep),
                sales_rep_email: quoteData.salesRep || 'sales@nwcustomapparel.com',
                sales_rep_phone: '253-922-5793',
                
                // Company
                company_year: '1977',
                
                // Quote details (HTML)
                products_html: this.generateQuoteHTML(quoteData),
                location_name: quoteData.locationName,
                expiry_date: quoteData.expiryDate.toLocaleDateString()
            };
            
            console.log('[DTGQuoteService] Email data prepared:', emailData);
            
            // When EmailJS template is ready, uncomment:
            // await emailjs.send('service_1c4k67j', 'template_xxxxx', emailData);
            
            return {
                success: true,
                message: 'Email functionality pending template creation'
            };
            
        } catch (error) {
            console.error('[DTGQuoteService] Error sending email:', error);
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
        let html = `
            <div style="font-family: Arial, sans-serif;">
                <h3 style="color: #4cb354;">DTG Print Quote</h3>
                <p><strong>Print Location:</strong> ${quoteData.locationName}</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Product</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Price</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Total</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        quoteData.products.forEach(product => {
            product.sizeGroups.forEach(group => {
                const sizeList = Object.entries(group.sizes)
                    .map(([size, qty]) => `${size}(${qty})`)
                    .join(' ');
                
                let priceDisplay = `$${group.basePrice.toFixed(2)}`;
                if (group.ltmPerUnit > 0) {
                    priceDisplay = `$${group.basePrice.toFixed(2)} + $${group.ltmPerUnit.toFixed(2)} = $${group.unitPrice.toFixed(2)}`;
                }
                
                html += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">
                            ${product.productName} - ${product.color}<br>
                            <small>${sizeList}</small>
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${group.quantity}</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${priceDisplay}</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${group.total.toFixed(2)}</td>
                    </tr>`;
            });
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
            html += `<p style="font-size: 12px; color: #666;">*Orders under 24 pieces include a small batch fee</p>`;
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
     * Load quote from database (for future functionality)
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
                session: session,
                items: items || []
            };
            
        } catch (error) {
            console.error('[DTGQuoteService] Error loading quote:', error);
            throw error;
        }
    }
}

// Make available globally
window.DTGQuoteService = DTGQuoteService;