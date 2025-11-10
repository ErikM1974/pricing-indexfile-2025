/**
 * ShopWorks OnSite 7 EDP Generator Service
 * Generates EDP (External Data Processor) files for importing quotes into ShopWorks
 *
 * Based on: OnSite 7 EDP Development Guide 08-16-10
 * Reference: OnSite 7 EDP Processing Guide
 *
 * EDP Format:
 * - Uses customizable Tag Brackets, Separators, and Carriage Returns
 * - Six data blocks: Order (req), Customer (req), Contact (opt), Design (opt), Products (opt), Payment (opt)
 * - Each block: Tag Bracket + " " + "Start/End " + Block Name + " " + Tag Bracket
 * - Fields: Field Name + Separator + Data + Carriage Return
 */

class EDPGeneratorService {
    constructor(config = {}) {
        // EDP Formatting Configuration
        // These match the sample settings from the OnSite 7 EDP Development Guide
        // IMPORTANT: These should match your ShopWorks EDP Table settings
        this.config = {
            tagBracket: config.tagBracket || '####',
            separator: config.separator || ': ',
            carriageReturn: config.carriageReturn || '\r\n',

            // ShopWorks-specific IDs (will need to be configured per installation)
            defaultOrderTypeID: config.defaultOrderTypeID || null,  // User must provide
            defaultPriceCalculatorID: config.defaultPriceCalculatorID || null,  // Optional

            // Formatting preferences
            includeProductBlock: config.includeProductBlock !== false,  // Default: true
            includeDesignBlock: config.includeDesignBlock !== false,   // Default: true
            includeContactBlock: config.includeContactBlock !== false, // Default: true

            // Part number format
            partNumberFormat: config.partNumberFormat || 'STYLE-COLOR-SIZE'  // or 'STYLE_SIZE_COLOR'
        };

        console.log('[EDPGenerator] Initialized with config:', this.config);
    }

    /**
     * Generate complete EDP file from quote data
     * @param {Object} quoteSession - Quote session data from quote_sessions table
     * @param {Array} quoteItems - Quote items from quote_items table
     * @returns {String} EDP formatted text
     */
    generateEDP(quoteSession, quoteItems) {
        console.log('[EDPGenerator] Generating EDP for quote:', quoteSession.QuoteID);
        console.log('[EDPGenerator] Items:', quoteItems.length);

        const blocks = [];

        // Order Block (REQUIRED)
        blocks.push(this.generateOrderBlock(quoteSession));

        // Customer Block (REQUIRED)
        blocks.push(this.generateCustomerBlock(quoteSession));

        // Contact Block (OPTIONAL)
        if (this.config.includeContactBlock) {
            blocks.push(this.generateContactBlock(quoteSession));
        }

        // Design Block (OPTIONAL - for embroidery details)
        if (this.config.includeDesignBlock && this.isEmbroideryQuote(quoteSession.QuoteID)) {
            const designBlock = this.generateDesignBlock(quoteSession, quoteItems);
            if (designBlock) {
                blocks.push(designBlock);
            }
        }

        // Products Block (OPTIONAL but recommended)
        if (this.config.includeProductBlock && quoteItems && quoteItems.length > 0) {
            blocks.push(this.generateProductsBlock(quoteItems));
        }

        // Combine all blocks with double line break between them
        const edpContent = blocks.filter(b => b).join(this.config.carriageReturn + this.config.carriageReturn);

        console.log('[EDPGenerator] Generated EDP content:', edpContent.length, 'characters');
        return edpContent;
    }

    /**
     * Generate Order Block (REQUIRED)
     * Contains order-level information
     */
    generateOrderBlock(quoteSession) {
        const lines = [];

        // Start block
        lines.push(this.formatBlockDelimiter('Start Order'));

        // External Order ID (maps to Quote ID)
        lines.push(this.formatField('ExtOrderID', quoteSession.QuoteID));

        // External date (quote creation date)
        if (quoteSession.CreatedAt) {
            const date = new Date(quoteSession.CreatedAt);
            lines.push(this.formatField('date_External', this.formatDate(date)));
        }

        // Order Type ID (ShopWorks internal ID - user must configure)
        if (this.config.defaultOrderTypeID) {
            lines.push(this.formatField('id_OrderType', this.config.defaultOrderTypeID));
        }

        // Customer Purchase Order (using Quote ID as reference)
        lines.push(this.formatField('CustomerPurchaseOrder', `NWCA Quote ${quoteSession.QuoteID}`));

        // Notes (combine from session notes)
        if (quoteSession.Notes) {
            // Clean notes for EDP format (remove special characters that might break import)
            const cleanNotes = quoteSession.Notes.replace(/[\r\n]+/g, ' ').substring(0, 255);
            lines.push(this.formatField('Notes', cleanNotes));
        }

        // Status
        lines.push(this.formatField('Status', 'Quote'));

        // End block
        lines.push(this.formatBlockDelimiter('End Order'));

        return lines.join(this.config.carriageReturn);
    }

    /**
     * Generate Customer Block (REQUIRED)
     * Contains customer information
     */
    generateCustomerBlock(quoteSession) {
        const lines = [];

        // Start block
        lines.push(this.formatBlockDelimiter('Start Customer'));

        // External Customer ID (use email as unique identifier)
        lines.push(this.formatField('ExtCustomerID', quoteSession.CustomerEmail || 'UNKNOWN'));

        // Company name
        if (quoteSession.CompanyName && quoteSession.CompanyName !== 'Not Provided') {
            lines.push(this.formatField('Company', quoteSession.CompanyName));
        }

        // Contact name
        if (quoteSession.CustomerName && quoteSession.CustomerName !== 'Guest') {
            lines.push(this.formatField('Contact', quoteSession.CustomerName));
        }

        // Phone
        if (quoteSession.Phone) {
            lines.push(this.formatField('Phone1', quoteSession.Phone));
        }

        // Email
        if (quoteSession.CustomerEmail) {
            lines.push(this.formatField('Email', quoteSession.CustomerEmail));
        }

        // Price Calculator (if configured)
        if (this.config.defaultPriceCalculatorID) {
            lines.push(this.formatField('id_PriceCalculator', this.config.defaultPriceCalculatorID));
        }

        // End block
        lines.push(this.formatBlockDelimiter('End Customer'));

        return lines.join(this.config.carriageReturn);
    }

    /**
     * Generate Contact Block (OPTIONAL)
     * Additional contact information
     */
    generateContactBlock(quoteSession) {
        const lines = [];

        // Start block
        lines.push(this.formatBlockDelimiter('Start Contact'));

        // Name
        if (quoteSession.CustomerName && quoteSession.CustomerName !== 'Guest') {
            lines.push(this.formatField('Name', quoteSession.CustomerName));
        }

        // Phone
        if (quoteSession.Phone) {
            lines.push(this.formatField('Phone', quoteSession.Phone));
        }

        // Email
        if (quoteSession.CustomerEmail) {
            lines.push(this.formatField('Email', quoteSession.CustomerEmail));
        }

        // End block
        lines.push(this.formatBlockDelimiter('End Contact'));

        return lines.join(this.config.carriageReturn);
    }

    /**
     * Generate Design Block (OPTIONAL)
     * For embroidery-specific information
     */
    generateDesignBlock(quoteSession, quoteItems) {
        // Check if we have embroidery design information
        if (!quoteItems || quoteItems.length === 0) {
            return null;
        }

        // Look for design information in the first item's data
        const firstItem = quoteItems[0];
        const lines = [];

        // Start block
        lines.push(this.formatBlockDelimiter('Start Design'));

        // Design name (use Quote ID as design reference)
        lines.push(this.formatField('DesignName', quoteSession.QuoteID));

        // Location information (if available in PrintLocation or PrintLocationName)
        if (firstItem.PrintLocation || firstItem.PrintLocationName) {
            const location = firstItem.PrintLocationName || firstItem.PrintLocation;
            lines.push(this.formatField('Location', location));
        }

        // Try to extract design details from SizeBreakdown JSON if it contains logo specs
        if (firstItem.SizeBreakdown) {
            try {
                const breakdown = JSON.parse(firstItem.SizeBreakdown);

                // If breakdown contains logo information
                if (breakdown.logos && Array.isArray(breakdown.logos)) {
                    // Add stitch count from first logo
                    if (breakdown.logos[0] && breakdown.logos[0].stitch) {
                        lines.push(this.formatField('StitchCount', breakdown.logos[0].stitch));
                    }
                }

                // If breakdown has tier information
                if (breakdown.tier) {
                    lines.push(this.formatField('Notes', `Pricing Tier: ${breakdown.tier}`));
                }
            } catch (e) {
                // SizeBreakdown might contain size data instead of logo data
                console.log('[EDPGenerator] Could not parse design details from SizeBreakdown');
            }
        }

        // End block
        lines.push(this.formatBlockDelimiter('End Design'));

        // Only return if we have meaningful content (more than just start/end)
        return lines.length > 2 ? lines.join(this.config.carriageReturn) : null;
    }

    /**
     * Generate Products Block (OPTIONAL but recommended)
     * Individual line items
     */
    generateProductsBlock(quoteItems) {
        const lines = [];

        // Start block
        lines.push(this.formatBlockDelimiter('Start Products'));

        // Process each quote item
        quoteItems.forEach((item, index) => {
            // Start product sub-block
            lines.push(this.formatBlockDelimiter('Start Product'));

            // Part Number (formatted based on configuration)
            const partNumber = this.formatPartNumber(item);
            lines.push(this.formatField('PartNumber', partNumber));

            // Product description
            if (item.ProductName) {
                lines.push(this.formatField('Description', item.ProductName));
            }

            // Quantity - handle size breakdown if available
            if (item.SizeBreakdown) {
                try {
                    const sizeData = JSON.parse(item.SizeBreakdown);

                    // Check if this is a size breakdown (object with size keys)
                    if (typeof sizeData === 'object' && !Array.isArray(sizeData)) {
                        // Create separate line items for each size
                        Object.entries(sizeData).forEach(([size, qty]) => {
                            if (qty && qty > 0 && !['logos', 'tier', 'setup'].includes(size)) {
                                const sizePartNumber = this.formatPartNumber({
                                    ...item,
                                    Size: size
                                });
                                lines.push(this.formatField('PartNumber', sizePartNumber));
                                lines.push(this.formatField('Quantity', qty));
                            }
                        });
                    } else {
                        // Use total quantity
                        lines.push(this.formatField('Quantity', item.Quantity || 0));
                    }
                } catch (e) {
                    // If parsing fails, use total quantity
                    lines.push(this.formatField('Quantity', item.Quantity || 0));
                }
            } else {
                // No size breakdown, use total quantity
                lines.push(this.formatField('Quantity', item.Quantity || 0));
            }

            // Unit Price (if available)
            if (item.FinalUnitPrice || item.BaseUnitPrice) {
                const price = item.FinalUnitPrice || item.BaseUnitPrice;
                lines.push(this.formatField('UnitPrice', this.formatCurrency(price)));
            }

            // Line Total (if available)
            if (item.LineTotal) {
                lines.push(this.formatField('LineTotal', this.formatCurrency(item.LineTotal)));
            }

            // Notes (combine various fields)
            const notes = [];
            if (item.PrintLocationName) notes.push(`Location: ${item.PrintLocationName}`);
            if (item.EmbellishmentType) notes.push(`Method: ${item.EmbellishmentType}`);
            if (item.HasLTM === 'Yes') notes.push('LTM Fee Applied');
            if (notes.length > 0) {
                lines.push(this.formatField('Notes', notes.join('; ')));
            }

            // End product sub-block
            lines.push(this.formatBlockDelimiter('End Product'));
        });

        // End block
        lines.push(this.formatBlockDelimiter('End Products'));

        return lines.join(this.config.carriageReturn);
    }

    /**
     * Format a field line: FieldName + Separator + Data
     */
    formatField(fieldName, value) {
        // Clean value (remove line breaks and trim)
        const cleanValue = String(value || '').replace(/[\r\n]+/g, ' ').trim();
        return `${fieldName}${this.config.separator}${cleanValue}`;
    }

    /**
     * Format a block delimiter: TagBracket + " " + "Start/End BlockName" + " " + TagBracket
     */
    formatBlockDelimiter(blockDescriptor) {
        return `${this.config.tagBracket} ${blockDescriptor} ${this.config.tagBracket}`;
    }

    /**
     * Format part number based on configuration
     */
    formatPartNumber(item) {
        const style = item.StyleNumber || 'UNKNOWN';
        const color = item.Color || item.ColorCode || '';
        const size = item.Size || '';

        if (this.config.partNumberFormat === 'STYLE_SIZE_COLOR') {
            return [style, size, color].filter(p => p).join('_');
        } else {
            // Default: STYLE-COLOR-SIZE
            return [style, color, size].filter(p => p).join('-');
        }
    }

    /**
     * Format date for EDP (MM/DD/YYYY)
     */
    formatDate(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    /**
     * Format currency (remove $ sign, ShopWorks expects numeric)
     */
    formatCurrency(amount) {
        return parseFloat(amount || 0).toFixed(2);
    }

    /**
     * Check if quote is embroidery-related
     */
    isEmbroideryQuote(quoteID) {
        return quoteID && (quoteID.startsWith('EMB') || quoteID.startsWith('CAP') || quoteID.startsWith('EMBC'));
    }

    /**
     * Download EDP file to user's computer
     */
    downloadEDPFile(edpContent, quoteID) {
        const filename = `${quoteID}-ShopWorks.txt`;

        // Create blob with EDP content
        const blob = new Blob([edpContent], { type: 'text/plain;charset=utf-8' });

        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        URL.revokeObjectURL(link.href);

        console.log('[EDPGenerator] Downloaded:', filename);
    }
}

// Make service globally available
window.EDPGeneratorService = EDPGeneratorService;

console.log('[EDPGenerator] Service loaded and ready');
