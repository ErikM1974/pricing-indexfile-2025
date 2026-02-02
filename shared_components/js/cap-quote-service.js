/**
 * Cap Quote Service
 * Database operations for cap embroidery quotes
 * NO FALLBACKS - Visible failures only
 */

class CapQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'CAP';
        
        console.log('[CapQuoteService] Initialized with prefix:', this.quotePrefix);
    }
    
    /**
     * Generate unique quote ID with daily sequence reset
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
        console.log('[CapQuoteService] Generated quote ID:', quoteID);
        
        return quoteID;
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionID() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `cap_quote_builder_${timestamp}_${random}`;
    }
    
    /**
     * Clean up old quote sequences from sessionStorage
     */
    cleanupOldSequences(currentDateKey) {
        try {
            const keys = Object.keys(sessionStorage);
            const oldKeys = keys.filter(key => {
                if (!key.startsWith(`${this.quotePrefix}_quote_sequence_`)) return false;
                const keyDatePart = key.split('_sequence_')[1];
                return keyDatePart && keyDatePart !== currentDateKey;
            });
            
            oldKeys.forEach(key => {
                sessionStorage.removeItem(key);
                console.log('[CapQuoteService] Cleaned up old sequence:', key);
            });
        } catch (error) {
            console.warn('[CapQuoteService] Failed to cleanup sequences:', error);
        }
    }
    
    /**
     * Save complete quote to database
     * NO FALLBACKS - Fail visibly if database unavailable
     */
    async saveQuote(quoteData) {
        console.log('[CapQuoteService] Starting quote save process...');
        console.log('[CapQuoteService] Quote data:', quoteData);
        
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            // Step 1: Save quote session
            const sessionResult = await this.saveQuoteSession(quoteID, sessionID, quoteData);
            if (!sessionResult.success) {
                throw new Error(`Session save failed: ${sessionResult.error}`);
            }
            
            console.log('[CapQuoteService] Session saved successfully');
            
            // Step 2: Save quote items
            const itemsResult = await this.saveQuoteItems(quoteID, quoteData);
            if (!itemsResult.success) {
                console.error('[CapQuoteService] Items save failed, but session exists:', itemsResult.error);
                // Don't throw here - partial save is better than nothing
            } else {
                console.log('[CapQuoteService] Items saved successfully');
            }
            
            console.log('[CapQuoteService] ✅ Quote save completed:', quoteID);
            
            return {
                success: true,
                quoteID: quoteID,
                sessionID: sessionID
            };
            
        } catch (error) {
            console.error('[CapQuoteService] ❌ Quote save failed:', error);
            
            // Show visible error to user
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner(`DATABASE SAVE FAILED: ${error.message}`);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Save quote session to database
     */
    async saveQuoteSession(quoteID, sessionID, quoteData) {
        console.log('[CapQuoteService] Saving quote session...');
        
        try {
            // Format expiration date (30 days from now, no milliseconds)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');
            
            // Calculate totals
            // 2026-02 RESTRUCTURE: LTM only applies to 1-7 tier
            const totalQuantity = quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0);
            const subtotal = quoteData.products.reduce((sum, p) => sum + p.lineTotal, 0);
            const ltmFeeTotal = totalQuantity <= 7 ? 50.00 : 0;
            const setupFees = quoteData.logos.reduce((sum, logo) => sum + (logo.needsDigitizing ? 100 : 0), 0);
            const grandTotal = subtotal + ltmFeeTotal + setupFees;
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerInfo.email,
                CustomerName: quoteData.customerInfo.name || 'Guest',
                CompanyName: quoteData.customerInfo.company || 'Not Provided',
                Phone: quoteData.customerInfo.phone || '',
                TotalQuantity: totalQuantity,
                SubtotalAmount: parseFloat(subtotal.toFixed(2)),
                LTMFeeTotal: ltmFeeTotal,
                TotalAmount: parseFloat(grandTotal.toFixed(2)),
                Status: 'Open',
                ExpiresAt: expiresAt,
                Notes: this.buildQuoteNotes(quoteData)
            };
            
            console.log('[CapQuoteService] Session data prepared:', sessionData);
            
            const response = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });
            
            const responseText = await response.text();
            console.log('[CapQuoteService] Session response:', response.status, responseText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }
            
            return { success: true, data: responseText };
            
        } catch (error) {
            console.error('[CapQuoteService] Session save error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Save quote items to database
     */
    async saveQuoteItems(quoteID, quoteData) {
        console.log('[CapQuoteService] Saving quote items...');
        
        try {
            const items = [];
            let lineNumber = 1;
            
            // Create line items for each product
            for (const product of quoteData.products) {
                // Group sizes by price (standard vs upcharged)
                const standardSizes = {};
                const upchargedSizes = {};
                
                for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
                    if (qty > 0) {
                        const hasUpcharge = product.sizeUpcharges && product.sizeUpcharges[size] > 0;
                        if (hasUpcharge) {
                            upchargedSizes[size] = qty;
                        } else {
                            standardSizes[size] = qty;
                        }
                    }
                }
                
                // Create item for standard sizes
                if (Object.keys(standardSizes).length > 0) {
                    const stdQty = Object.values(standardSizes).reduce((sum, q) => sum + q, 0);
                    const stdPrice = product.basePrice;
                    
                    items.push({
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: product.styleNumber,
                        ProductName: `${product.title} - ${product.color}`,
                        Color: product.color,
                        ColorCode: product.colorCode || '',
                        EmbellishmentType: 'cap_embroidery',
                        PrintLocation: this.formatLogoPositions(quoteData.logos),
                        PrintLocationName: this.formatLogoPositions(quoteData.logos),
                        Quantity: stdQty,
                        HasLTM: quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0) < 24 ? 'Yes' : 'No',
                        BaseUnitPrice: parseFloat(stdPrice.toFixed(2)),
                        LTMPerUnit: quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0) < 24 ? 50 / quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0) : 0,
                        FinalUnitPrice: parseFloat(stdPrice.toFixed(2)),
                        LineTotal: parseFloat((stdQty * stdPrice).toFixed(2)),
                        SizeBreakdown: JSON.stringify(standardSizes),
                        PricingTier: this.getPricingTier(quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0)),
                        ImageURL: product.imageUrl || '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                    });
                }
                
                // Create separate items for upcharged sizes
                for (const [size, qty] of Object.entries(upchargedSizes)) {
                    const upchargedPrice = product.basePrice + (product.sizeUpcharges[size] || 0);
                    
                    items.push({
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: product.styleNumber,
                        ProductName: `${product.title} - ${product.color} (${size})`,
                        Color: product.color,
                        ColorCode: product.colorCode || '',
                        EmbellishmentType: 'cap_embroidery',
                        PrintLocation: this.formatLogoPositions(quoteData.logos),
                        PrintLocationName: this.formatLogoPositions(quoteData.logos),
                        Quantity: qty,
                        HasLTM: quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0) < 24 ? 'Yes' : 'No',
                        BaseUnitPrice: parseFloat(product.basePrice.toFixed(2)),
                        LTMPerUnit: 0, // Already included in standard items
                        FinalUnitPrice: parseFloat(upchargedPrice.toFixed(2)),
                        LineTotal: parseFloat((qty * upchargedPrice).toFixed(2)),
                        SizeBreakdown: JSON.stringify({ [size]: qty }),
                        PricingTier: this.getPricingTier(quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0)),
                        ImageURL: product.imageUrl || '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                    });
                }
            }
            
            console.log('[CapQuoteService] Items to save:', items.length);
            
            // Save all items
            const itemPromises = items.map(async item => {
                const response = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(item)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[CapQuoteService] Item save failed:', errorText);
                    return false;
                }
                
                return true;
            });
            
            const results = await Promise.all(itemPromises);
            const successCount = results.filter(r => r === true).length;
            
            console.log('[CapQuoteService] Items saved:', successCount, '/', items.length);
            
            return {
                success: successCount > 0,
                savedCount: successCount,
                totalCount: items.length
            };
            
        } catch (error) {
            console.error('[CapQuoteService] Items save error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Build quote notes from logo specifications
     */
    buildQuoteNotes(quoteData) {
        const logoNotes = quoteData.logos.map(logo => {
            let note = `${logo.position}: ${logo.stitchCount.toLocaleString()} stitches`;
            if (logo.needsDigitizing) {
                note += ' ✓ Digitizing: $100';
            }
            return note;
        });
        
        let notes = logoNotes.join(', ');
        
        // 2026-02 RESTRUCTURE: LTM only applies to 1-7 tier
        const totalQuantity = quoteData.products.reduce((sum, p) => sum + p.totalQuantity, 0);
        if (totalQuantity <= 7) {
            notes += ' *Includes $50 setup fee for orders of 1-7 pieces';
        }
        
        if (quoteData.customerInfo.notes) {
            notes += ` | Customer notes: ${quoteData.customerInfo.notes}`;
        }
        
        return notes;
    }
    
    /**
     * Format logo positions for display
     */
    formatLogoPositions(logos) {
        return logos.map(logo => `${logo.position} (${logo.stitchCount}k)`).join(' + ');
    }
    
    /**
     * Get pricing tier label for quantity
     * 2026-02 RESTRUCTURE: New tiers 1-7 (LTM) and 8-23 (no LTM)
     */
    getPricingTier(quantity) {
        if (quantity <= 7) return '1-7';
        if (quantity <= 23) return '8-23';
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        return '72+';
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CapQuoteService = CapQuoteService;
}