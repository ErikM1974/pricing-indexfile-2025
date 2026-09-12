/**
 * Customer Screen Print Quote Service
 * Handles saving Customer Supplied Screen Print quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

var SCRECUSTQUOT_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var screcustquotLog = SCRECUSTQUOT_LOG_ON ? console.log.bind(console) : function () {}; // debug logging: localhost or ?debug=1 only (2026-09-06 console sweep)
class CustomerScreenPrintQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'SPC',
            storagePrefix: 'customer_screenprint',
            sessionPrefix: 'spc_sess'
        });
        this.savedStages = new Map();
    }

    /**
     * Get embellishment type for screen print
     */
    getEmbellishmentType() {
        return 'screenprint';
    }

    /**
     * Save Customer Screen Print quote
     */
    async saveQuote(quoteData) {
        try {
            // Use the ID the caller already generated and showed the customer
            // (handleQuoteSubmit) — calling generateQuoteID() again here produced
            // a SECOND, different sequential ID, so the quote saved to Caspio
            // never matched what the customer was told (2026-07-01 bug: customer
            // sees SPC0701-1, the saved row is SPC0701-2 — a rep searching by the
            // customer's ID finds nothing).
            if (!quoteData.quoteId) {
                throw new Error('saveQuote() requires quoteData.quoteId (the ID already shown to the customer).');
            }
            const quoteID = quoteData.quoteId;
            const key = JSON.stringify(quoteData);
            let progress = this.savedStages.get(quoteID);
            if (progress && progress.key !== key) throw new Error('A quote ID cannot be reused for changed details.');
            if (!progress) {
                progress = {key, sessionID: this.generateSessionID()};
                this.savedStages.set(quoteID, progress);
            }
            const sessionID = progress.sessionID;

            screcustquotLog('[CustomerScreenPrintQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.quantity || 0),
                SubtotalAmount: parseFloat((quoteData.orderSubtotal || 0).toFixed(2)),
                LTMFeeTotal: parseFloat((quoteData.ltmFeeTotal || 0).toFixed(2)),
                TotalAmount: parseFloat((quoteData.finalTotal || 0).toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            screcustquotLog('[CustomerScreenPrintQuoteService] Session data:', sessionData);

            if (!progress.sessionSaved) {
                const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(sessionData)
                });

                // Get response text first to see error details
                const responseText = await sessionResponse.text();
                screcustquotLog('[CustomerScreenPrintQuoteService] Session response status:', sessionResponse.status);
                screcustquotLog('[CustomerScreenPrintQuoteService] Session response text:', responseText);

                if (!sessionResponse.ok) {
                    let errorMessage = `Session creation failed: ${sessionResponse.status}`;
                    try {
                        const errorData = JSON.parse(responseText);
                        errorMessage = errorData.message || errorData.error || errorMessage;
                    } catch (e) {
                        errorMessage += ` - ${responseText}`;
                    }
                    throw new Error(errorMessage);
                }

                // Parse successful response
                let sessionResult;
                try {
                    sessionResult = JSON.parse(responseText);
                } catch (e) {
                    console.error('[CustomerScreenPrintQuoteService] Failed to parse success response:', e);
                    sessionResult = { success: true, message: responseText };
                }

                screcustquotLog('[CustomerScreenPrintQuoteService] Session created:', sessionResult);

                progress.sessionSaved = true;
                progress.sessionResult = sessionResult;
            }

            // Step 2: Add item to quote
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');

            // Build product description
            let productName = 'Customer Supplied Screen Print';
            if (quoteData.isDarkGarment) {
                productName += ' (Dark Garment)';
            }
            if (quoteData.safetyStripes) {
                productName += ' [Safety Stripes]';
            }

            // Build print location description
            const locations = [];
            if (quoteData.frontColors > 0) {
                locations.push(`Front: ${quoteData.frontColors} color${quoteData.frontColors > 1 ? 's' : ''}`);
            }
            if (quoteData.backColors > 0) {
                locations.push(`Back: ${quoteData.backColors} color${quoteData.backColors > 1 ? 's' : ''}`);
            }
            const printLocation = locations.join(', ') || 'No Print';

            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'CUSTOMER-SP',
                ProductName: productName,
                Color: 'Customer Supplied',
                ColorCode: '',
                EmbellishmentType: 'screenprint',
                PrintLocation: printLocation,
                PrintLocationName: printLocation,
                Quantity: parseInt(quoteData.quantity || 0),
                HasLTM: quoteData.ltmFeeTotal > 0 ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat((quoteData.pricePerShirt || 0).toFixed(2)),
                LTMPerUnit: 0, // LTM is applied as a flat fee, not per unit
                FinalUnitPrice: parseFloat((quoteData.pricePerShirt || 0).toFixed(2)),
                LineTotal: parseFloat((quoteData.orderSubtotal || 0).toFixed(2)),
                SizeBreakdown: '{}',
                PricingTier: quoteData.tierLabel || '',
                ImageURL: '',
                AddedAt: addedAt
            };

            screcustquotLog('[CustomerScreenPrintQuoteService] Item data:', itemData);

            if (!progress.itemSaved) {
                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                const itemResponseText = await itemResponse.text();
                screcustquotLog('[CustomerScreenPrintQuoteService] Item response status:', itemResponse.status);
                screcustquotLog('[CustomerScreenPrintQuoteService] Item response text:', itemResponseText);

                if (!itemResponse.ok) {
                    let errorMessage = `Item creation failed: ${itemResponse.status}`;
                    try {
                        const errorData = JSON.parse(itemResponseText);
                        errorMessage = errorData.message || errorData.error || errorMessage;
                    } catch (e) {
                        errorMessage += ` - ${itemResponseText}`;
                    }
                    throw new Error(errorMessage);
                }

                progress.itemSaved = true;
            }

            // Step 3: itemize the one-time screen-setup fee as its OWN quote_items line
            // so the saved record reconciles: Subtotal (line 1) + LTM (session) + this
            // setup line === TotalAmount. Without it, Quote Management shows an
            // unexplained gap (SubtotalAmount + LTMFeeTotal ≠ TotalAmount). Mirrors the
            // staff builder's fee-line convention (screenprint-quote-service.js
            // _saveShipFeeItem: EmbellishmentType='fee', Quantity 1, fee in *UnitPrice/
            // LineTotal). Report an incomplete save if this line fails; keep the
            // confirmed session and product line for a manual retry of the missing fee.
            const setupFee = parseFloat((quoteData.setupFee || 0).toFixed(2));
            if (setupFee > 0 && !progress.setupSaved) {
                const setupItemData = {
                    QuoteID: quoteID,
                    LineNumber: 2,
                    StyleNumber: 'SETUP',
                    ProductName: 'Screen Setup Fee',
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'fee',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: 1,
                    HasLTM: 'No',
                    BaseUnitPrice: setupFee,
                    LTMPerUnit: 0,
                    FinalUnitPrice: setupFee,
                    LineTotal: setupFee,
                    SizeBreakdown: '{}',
                    PricingTier: quoteData.tierLabel || '',
                    ImageURL: '',
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                };
                const setupResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(setupItemData)
                });
                if (!setupResponse.ok) {
                    throw new Error('Setup-fee line save failed: ' + setupResponse.status);
                }
                progress.setupSaved = true;
            }

            return {
                success: true,
                quoteID: quoteID,
                sessionData: progress.sessionResult
            };

        } catch (error) {
            console.error('[CustomerScreenPrintQuoteService] Error saving quote:', error);
            const progress = this.savedStages.get(quoteData.quoteId);
            return {success: false, quoteID: quoteData.quoteId, sessionSaved: !!(progress && progress.sessionSaved), itemSaved: !!(progress && progress.itemSaved), error: error.message};
        }
    }
}

// Make available globally
window.CustomerScreenPrintQuoteService = CustomerScreenPrintQuoteService;