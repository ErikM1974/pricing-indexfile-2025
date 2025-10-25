/**
 * Inksoft/ShopWorks EDP (Electronic Data Processing) Text Generator
 *
 * Generates EDP-formatted text for importing screen print quotes into ShopWorks via Inksoft format.
 * When imported, creates orders that match the ShopWorks Data Entry Guide layout exactly.
 *
 * Inksoft EDP Format Specification:
 * - Block Delimiters: ---- Start [BlockName] ---- / ---- End [BlockName] ----
 * - Data Separator: >> (double greater-than with space)
 * - Carriage Return: \n (actual newline between fields)
 * - Carriage Return in values: [cr] (literal text for line breaks within field values)
 *
 * Configuration:
 * - id_OrderType: 13 (Screen Print)
 * - id_Customer: 3739 (Northwest Custom Apparel)
 * - Company: Northwest Custom Apparel
 * - ExtSource: SP Quote
 */

class ShopWorksEDPGenerator {
    constructor() {
        // Reuse screen print guide generator for parsing logic
        this.guideGenerator = new ScreenPrintShopWorksGuideGenerator();

        // ShopWorks configuration
        this.config = {
            orderType: 13,              // Screen Print
            customerId: 3739,           // Northwest Custom Apparel
            company: 'Northwest Custom Apparel',
            extSource: 'SP Quote'
        };

        console.log('[ShopWorksEDP] Generator initialized');
    }

    /**
     * Generate EDP text from quote data
     * @param {Object} quoteData - Quote data in same format as ShopWorks guide
     */
    generateEDP(quoteData) {
        console.log('[ShopWorksEDP] Generating EDP for quote:', quoteData);

        try {
            // Parse quote into line items (reuses guide generator logic)
            const lineItems = this.guideGenerator.parseQuoteIntoLineItems(quoteData);
            console.log('[ShopWorksEDP] Parsed into', lineItems.length, 'line items');

            // Convert to EDP text format
            const edpText = this.convertToEDPFormat(lineItems, quoteData);
            console.log('[ShopWorksEDP] Generated EDP text:', edpText.length, 'characters');

            // Display in modal
            this.showEDPModal(edpText, quoteData.QuoteID);

        } catch (error) {
            console.error('[ShopWorksEDP] Error generating EDP:', error);
            alert('Error generating EDP text. Please check console for details.');
        }
    }

    /**
     * Convert line items to Inksoft EDP text format
     * @param {Array} lineItems - Parsed line items from guide generator
     * @param {Object} quoteData - Original quote data
     * @returns {string} EDP formatted text
     */
    convertToEDPFormat(lineItems, quoteData) {
        let edp = '';

        // Order Block (Inksoft format)
        edp += '---- Start Order ----\n';
        edp += `ExtOrderID>> ${quoteData.QuoteID}\n`;
        edp += `ExtSource>> ${this.config.extSource}\n`;
        edp += `date_OrderPlaced>> ${this.getTodayDate()}\n`;
        edp += `id_OrderType>> ${this.config.orderType}\n`;
        edp += `id_Customer>> ${this.config.customerId}\n`;
        edp += `Company>> ${this.config.company}\n`;
        edp += '---- End Order ----\n\n';

        // Customer Block (Inksoft format)
        edp += '---- Start Customer ----\n';
        edp += `id_Customer>> ${this.config.customerId}\n`;
        edp += '---- End Customer ----\n\n';

        // Product Blocks (one per line item - preserves size-specific pricing)
        lineItems.forEach((item, index) => {
            console.log(`[ShopWorksEDP] Converting line item ${index + 1}:`, item.partNumber);
            edp += this.convertLineItemToEDP(item);
        });

        return edp;
    }

    /**
     * Convert a single line item to EDP Product block
     * @param {Object} item - Line item from guide generator
     * @returns {string} EDP Product block text
     *
     * CRITICAL: Field order and completeness matters for ShopWorks import!
     * All 6 size fields MUST be present (even if empty) or import will be corrupted.
     * Field order must match working Inksoft examples exactly.
     */
    convertLineItemToEDP(item) {
        let edp = '---- Start Product ----\n';

        // Part Number (required)
        edp += `PartNumber>> ${item.partNumber}\n`;

        // Part Color Range (empty but required)
        edp += `PartColorRange>>\n`;

        // Part Color (optional but usually present)
        // Use catalogColor (ShopWorks format) if available, fallback to color for backwards compatibility
        edp += `PartColor>> ${item.catalogColor || item.color || ''}\n`;

        // Unit Price (required)
        const unitPrice = item.manualPrice !== undefined && item.manualPrice !== null
            ? item.manualPrice.toFixed(2)
            : '0.00';
        edp += `cur_UnitPriceUserEntered>> ${unitPrice}\n`;

        // Order Instructions (empty but required)
        edp += `OrderInstructions>>\n`;

        // Size Matrix - ALL 6 FIELDS MUST BE PRESENT (empty if no quantity)
        // This is CRITICAL - omitting fields causes ShopWorks to misalign data
        edp += `Size01_Req>> ${item.sizes.S || ''}\n`;        // S column
        edp += `Size02_Req>> ${item.sizes.M || ''}\n`;        // M column
        edp += `Size03_Req>> ${item.sizes.LG || ''}\n`;       // LG column (Large)
        edp += `Size04_Req>> ${item.sizes.XL || ''}\n`;       // XL column
        edp += `Size05_Req>> ${item.sizes.XXL || ''}\n`;      // XXL column (2XL)
        edp += `Size06_Req>> ${item.sizes.XXXL || ''}\n`;     // XXXL column (3XL, 4XL, 5XL, 6XL, XS, etc.)

        // Product Override (required)
        edp += `sts_Prod_Product_Override>> 1\n`;

        // Description (optional but usually present)
        edp += `PartDescription>> ${item.description || ''}\n`;

        // Unit Cost (required - use 0.00 for quotes)
        edp += `cur_UnitCost>> 0.00\n`;

        // Commission Settings (required)
        edp += `sts_EnableCommission>> 0\n`;

        // Product Class (required)
        edp += `id_ProductClass>> 1\n`;

        // Sales Tax Settings (required)
        edp += `sts_Prod_SalesTax_Override>> 1\n`;
        edp += `sts_EnableTax01>> 1\n`;
        edp += `sts_EnableTax02>> 0\n`;
        edp += `sts_EnableTax03>> 0\n`;
        edp += `sts_EnableTax04>> 0\n`;

        // Secondary Units Override (required - all empty)
        edp += `sts_Prod_SecondaryUnits_Override>> 0\n`;
        edp += `sts_UseSecondaryUnits>>\n`;
        edp += `Units_Qty>>\n`;
        edp += `Units_Type>>\n`;
        edp += `Units_Area1>>\n`;
        edp += `Units_Area2>>\n`;
        edp += `sts_UnitsPricing>>\n`;
        edp += `sts_UnitsPurchasing>>\n`;
        edp += `sts_UnitsPurchasingExtraPercent>>\n`;
        edp += `sts_UnitsPurchasingExtraRound>>\n`;

        // Behavior Override (required - all empty)
        edp += `sts_Prod_Behavior_Override>> 0\n`;
        edp += `sts_ProductSource_Supplied>>\n`;
        edp += `sts_ProductSource_Purchase>>\n`;
        edp += `sts_ProductSource_Inventory>>\n`;
        edp += `sts_Production_Designs>>\n`;
        edp += `sts_Production_Subcontract>>\n`;
        edp += `sts_Production_Components>>\n`;
        edp += `sts_Storage_Ship>>\n`;
        edp += `sts_Storage_Inventory>>\n`;
        edp += `sts_Invoicing_Invoice>>\n`;

        // End Product block
        edp += '---- End Product ----\n';

        return edp;
    }

    /**
     * Get today's date in MM/DD/YYYY format (Inksoft format)
     * @returns {string} Today's date
     */
    getTodayDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${month}/${day}/${year}`;
    }

    /**
     * Display EDP text in modal
     * @param {string} edpText - Generated EDP text
     * @param {string} quoteID - Quote ID
     */
    showEDPModal(edpText, quoteID) {
        const modal = document.getElementById('edp-modal');
        const textarea = document.getElementById('edp-text');
        const quoteIdDisplay = document.getElementById('edp-quote-id');

        if (!modal || !textarea || !quoteIdDisplay) {
            console.error('[ShopWorksEDP] Modal elements not found');
            alert('Error: EDP modal elements not found. Please check HTML structure.');
            return;
        }

        // Set quote ID
        quoteIdDisplay.textContent = quoteID;

        // Set EDP text and auto-select for easy copying
        textarea.value = edpText;

        // Show modal
        modal.style.display = 'block';

        // Auto-select text after a brief delay (ensures modal is visible)
        setTimeout(() => {
            textarea.select();
            textarea.focus();
        }, 100);

        console.log('[ShopWorksEDP] Modal displayed with', edpText.length, 'characters');
    }

    /**
     * Copy EDP text to clipboard
     */
    copyToClipboard() {
        const textarea = document.getElementById('edp-text');

        if (!textarea) {
            console.error('[ShopWorksEDP] Textarea not found');
            return;
        }

        try {
            // Select text
            textarea.select();
            textarea.setSelectionRange(0, 99999); // For mobile devices

            // Copy to clipboard
            const successful = document.execCommand('copy');

            if (successful) {
                // Show success feedback
                const originalText = event.target.innerHTML;
                event.target.innerHTML = '<i class="fas fa-check"></i> Copied!';
                event.target.classList.add('btn-success');

                setTimeout(() => {
                    event.target.innerHTML = originalText;
                }, 2000);

                console.log('[ShopWorksEDP] Text copied to clipboard');
            } else {
                throw new Error('Copy command failed');
            }

        } catch (error) {
            console.error('[ShopWorksEDP] Copy failed:', error);
            alert('Copy failed. Please manually select and copy the text.');
        }
    }
}

// Log when service loads
console.log('[ShopWorksEDP] Service loaded successfully');
