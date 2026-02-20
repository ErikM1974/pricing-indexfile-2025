/**
 * ShopWorks Data Entry Guide Generator
 * Generates a printable HTML/PDF document showing exactly how to enter
 * embroidery quotes into ShopWorks with correct part numbers and formatting.
 *
 * Supports:
 * - Product line items (garments/caps with size breakdowns)
 * - Fee/charge line items (digitizing, stitch charges, art, rush, LTM, etc.)
 *
 * CRITICAL: Uses _2X format (NOT _2XL) for oversize part numbers to match ShopWorks inventory
 */

class ShopWorksGuideGenerator {
    constructor() {
        // Part number suffix mapping (ShopWorks format)
        // IMPORTANT: ShopWorks uses mixed conventions - Port & Co: _XXL, Jerzees: _2X
        this.partNumberSuffixMap = {
            // Standard sizes: NO suffix (S, M, L, XL ONLY)
            'S': '',
            'M': '',
            'L': '',
            'XL': '',
            // Extra Small and XXL oversizes
            'XS': '_XS',
            'XXL': '_XXL',  // Ladies/Womens 2XL (589 products, distinct from _2XL)
            // Oversizes: full form per ShopWorks pricelist (_2X/_3X do NOT exist)
            '2XL': '_2XL',
            '3XL': '_3XL',
            '4XL': '_4XL',
            '5XL': '_5XL',
            '6XL': '_6XL',
            'XXXL': '_XXXL',
            '7XL': '_7XL',
            '8XL': '_8XL',
            '9XL': '_9XL',
            '10XL': '_10XL',
            // Tall sizes: Keep full suffix
            'LT': 'T_LT',
            'XLT': 'T_XLT',
            '2XLT': 'T_2XLT',
            '3XLT': 'T_3XLT',
            '4XLT': 'T_4XLT',
            // Youth: Add Y prefix
            'YXS': 'Y_XS',
            'YS': 'Y',
            'YM': 'Y',
            'YL': 'Y',
            'YXL': 'Y',
            // One size
            'OSFA': '_OSFA'
        };
    }

    /**
     * Generate ShopWorks entry guide from quote data
     * Opens in new window for preview with manual print button
     * @param {Object} quoteData - Quote data with products and optional feeItems array
     */
    generateGuide(quoteData) {
        try {
            // Parse quote data into ShopWorks line items
            const lineItems = this.parseQuoteIntoLineItems(quoteData);

            // Get fee items (passed in quoteData or empty)
            const feeItems = quoteData.feeItems || [];

            // Generate HTML document
            const html = this.generateHTML(lineItems, feeItems, quoteData);

            // Open in new window
            const printWindow = window.open('', '_blank', 'width=1200,height=800');
            if (!printWindow) {
                alert('Please allow pop-ups to download the ShopWorks guide');
                return;
            }

            printWindow.document.write(html);
            printWindow.document.close();

            // Auto-trigger print dialog after brief delay
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 500);

        } catch (error) {
            console.error('[ShopWorksGuide] Error generating guide:', error);
            alert('Error generating ShopWorks guide. Please check console for details.');
        }
    }

    /**
     * Parse quote data into ShopWorks line items
     * Groups standard sizes (S/M/L/XL) into one line, oversizes get separate lines
     */
    parseQuoteIntoLineItems(quoteData) {
        const items = [];

        // Handle multiple products in quote
        const products = quoteData.products || [quoteData];

        products.forEach(product => {
            // Parse size breakdown
            let sizeBreakdown = {};
            if (typeof product.SizeBreakdown === 'string') {
                try {
                    sizeBreakdown = JSON.parse(product.SizeBreakdown);
                } catch (e) {
                    console.warn('[ShopWorksGuide] Could not parse SizeBreakdown:', e);
                }
            } else if (typeof product.SizeBreakdown === 'object') {
                sizeBreakdown = product.SizeBreakdown;
            }

            // Separate standard sizes from oversizes
            const standardSizes = {};
            const oversizes = {};

            Object.entries(sizeBreakdown).forEach(([size, qty]) => {
                if (!qty || qty === 0) return;

                // Filter out non-size keys
                if (['logos', 'tier', 'setup', 'stitchCount'].includes(size)) return;

                // Standard sizes: ONLY S, M, L, XL (grouped under base part number)
                // Oversizes: XS, XXL/2XL, 3XL+ (get separate lines with suffixes)
                if (['S', 'M', 'L', 'XL'].includes(size.toUpperCase())) {
                    standardSizes[size] = parseInt(qty);
                } else {
                    oversizes[size] = parseInt(qty);
                }
            });

            // Line 1: Standard sizes grouped together
            if (Object.keys(standardSizes).length > 0) {
                const totalStandardQty = Object.values(standardSizes).reduce((a, b) => a + b, 0);

                items.push({
                    lineQty: totalStandardQty,
                    partNumber: product.StyleNumber || product.styleNumber,
                    colorRange: '',
                    color: product.Color || product.color || '',
                    catalogColor: product.CatalogColor || product.catalogColor || '',
                    description: product.ProductName || product.productName || '',
                    sizes: this.formatSizesForShopWorks(standardSizes),
                    manualPrice: this.getStandardSizePrice(standardSizes, product),
                    calcPrice: 'Off',
                    lineTotal: this.calculateLineTotal(standardSizes, product)
                });
            }

            // Lines 2+: Each oversize gets its own line
            Object.entries(oversizes).forEach(([size, qty]) => {
                const suffix = this.partNumberSuffixMap[size] || `_${size}`;
                const basePartNumber = product.StyleNumber || product.styleNumber;

                items.push({
                    lineQty: qty,
                    partNumber: `${basePartNumber}${suffix}`,
                    colorRange: '',
                    color: product.Color || product.color || '',
                    catalogColor: product.CatalogColor || product.catalogColor || '',
                    description: product.ProductName || product.productName || '',
                    sizes: this.formatSizesForShopWorks({ [size]: qty }),
                    manualPrice: this.getPriceForSize(size, product),
                    calcPrice: 'Off',
                    lineTotal: qty * this.getPriceForSize(size, product)
                });
            });
        });

        return items;
    }

    /**
     * Format sizes into ShopWorks column structure
     * Matches actual ShopWorks layout: S, M, LG, XL, XXL, XXXL (no Adult or Other columns)
     */
    formatSizesForShopWorks(sizeBreakdown) {
        const shopWorksFormat = {
            S: '',
            M: '',
            LG: '',
            XL: '',
            XXL: '',
            XXXL: ''  // Holds both 3XL and "other" sizes (XS, 4XL+, youth, OSFA)
        };

        let hasNonStandardXXXL = false;

        Object.entries(sizeBreakdown).forEach(([size, qty]) => {
            const column = this.getSizeColumn(size);

            // Track if XXXL column contains non-3XL sizes (for visual highlighting)
            if (column === 'XXXL' && size.toUpperCase() !== '3XL') {
                hasNonStandardXXXL = true;
            }

            if (column && shopWorksFormat.hasOwnProperty(column)) {
                shopWorksFormat[column] = qty || '';
            }
        });

        return { ...shopWorksFormat, hasNonStandardXXXL };
    }

    /**
     * Map size to ShopWorks column name
     * Note: ShopWorks XXXL column holds both 3XL and "other" sizes (XS, 4XL+, youth, OSFA)
     */
    getSizeColumn(size) {
        const sizeUpper = size.toUpperCase();

        const columnMap = {
            'XS': 'XXXL',
            'S': 'S',
            'M': 'M',
            'L': 'LG',      // ShopWorks uses "LG" not "L"
            'XL': 'XL',
            'XXL': 'XXL',
            '2XL': 'XXL',
            '3XL': 'XXXL',
            '4XL': 'XXXL',
            '5XL': 'XXXL',
            '6XL': 'XXXL',
            '7XL': 'XXXL',
            '8XL': 'XXXL',
            '9XL': 'XXXL',
            '10XL': 'XXXL',
            'OSFA': 'XXXL',
            'YXS': 'XXXL',
            'YS': 'XXXL',
            'YM': 'XXXL',
            'YL': 'XXXL',
            'YXL': 'XXXL'
        };

        return columnMap[sizeUpper] || 'XXXL';  // Default to XXXL for unknown sizes
    }

    /**
     * Calculate line total for a group of sizes
     * Uses size-specific pricing when available to ensure accuracy
     */
    calculateLineTotal(sizes, product) {
        // If we have size-specific pricing, calculate total by summing each size
        if (product.SizesPricing) {
            let total = 0;
            Object.entries(sizes).forEach(([size, qty]) => {
                const price = this.getPriceForSize(size, product);
                total += qty * price;
            });
            return total;
        }

        // Fallback to using average price if size-specific pricing not available
        const totalQty = Object.values(sizes).reduce((a, b) => a + b, 0);
        const price = parseFloat(product.FinalUnitPrice || product.BaseUnitPrice || 0);
        return totalQty * price;
    }

    /**
     * Get price for specific size (handles size upcharges if needed)
     */
    getPriceForSize(size, product) {
        // First, check if size-specific pricing is available
        if (product.SizesPricing && product.SizesPricing[size]) {
            return parseFloat(product.SizesPricing[size]);
        }

        // Fall back to final price (includes LTM) if size-specific pricing not available
        return parseFloat(product.FinalUnitPrice || product.BaseUnitPrice || 0);
    }

    /**
     * Get the price for standard sizes (S/M/L/XL)
     * Since all standard sizes have the same price, we can use any of them
     */
    getStandardSizePrice(standardSizes, product) {
        const firstSize = Object.keys(standardSizes).find(size => standardSizes[size] > 0);

        if (firstSize) {
            return this.getPriceForSize(firstSize, product);
        }

        // Fallback to FinalUnitPrice if no sizes found (shouldn't happen)
        console.warn('[ShopWorksGuide] No standard sizes found, falling back to FinalUnitPrice');
        return parseFloat(product.FinalUnitPrice || product.BaseUnitPrice || 0);
    }

    /**
     * Generate HTML document with product rows and fee rows
     */
    generateHTML(lineItems, feeItems, quoteData) {
        const today = new Date().toLocaleDateString();
        const customerName = quoteData.CustomerName || quoteData.customerName || 'Customer';
        const quoteID = quoteData.QuoteID || quoteData.quoteID || 'N/A';
        const totalQty = quoteData.TotalQuantity || lineItems.reduce((sum, item) => sum + item.lineQty, 0);

        // Product subtotal from line items
        const productSubtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);

        // Fee subtotal (positive fees minus discount)
        const feeSubtotal = feeItems.reduce((sum, fee) => sum + fee.lineTotal, 0);

        // Combined subtotal
        const subtotal = quoteData.SubtotalAmount || (productSubtotal + feeSubtotal);

        // Calculate 10.1% Milton, WA sales tax
        const tax = quoteData.SalesTaxAmount || (subtotal * 0.101);
        const total = quoteData.TotalAmount || (subtotal + tax);

        // Generate fee rows HTML
        const feeRowsHTML = feeItems.length > 0 ? `
            <tr class="fee-section-header">
                <td colspan="14" style="background: #1565c0; color: white; font-weight: bold; text-align: left; padding: 8px; font-size: 10pt;">
                    FEES &amp; CHARGES
                </td>
            </tr>
            ${feeItems.map((fee, idx) => `
                <tr class="fee-row">
                    <td>${fee.quantity}</td>
                    <td class="part-number" style="color: #1565c0;">${fee.partNumber}</td>
                    <td></td>
                    <td></td>
                    <td class="text-left">${fee.description}</td>
                    <td></td><td></td><td></td><td></td><td></td><td></td>
                    <td>${fee.unitPrice != null ? '$' + fee.unitPrice.toFixed(2) : ''}</td>
                    <td>Off</td>
                    <td${fee.lineTotal < 0 ? ' style="color: #d32f2f; font-weight: bold;"' : ''}>$${fee.lineTotal.toFixed(2)}</td>
                </tr>
            `).join('')}
        ` : '';

        // Generate checklist items for fees
        const feeChecklistItems = feeItems.map(fee =>
            `<li>Enter <strong>${fee.partNumber}</strong> — ${fee.description} (${fee.quantity > 1 ? fee.quantity + ' × ' : ''}$${fee.lineTotal.toFixed(2)})</li>`
        ).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShopWorks Entry Guide - ${quoteID}</title>
    <style>
        @page {
            size: landscape;
            margin: 0.5in;
        }

        @media print {
            .no-print {
                display: none;
            }
            body {
                margin: 0;
            }
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            margin: 20px;
            background: white;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
        }

        .header h1 {
            margin: 0 0 10px 0;
            font-size: 24pt;
            color: #2d5f3f;
        }

        .header h2 {
            margin: 5px 0;
            font-size: 18pt;
            color: #333;
        }

        .header p {
            margin: 5px 0;
            font-size: 11pt;
        }

        .warning {
            background: #ffeb3b;
            border: 3px solid #f57c00;
            padding: 12px;
            margin: 15px 0;
            font-weight: bold;
            text-align: center;
            font-size: 12pt;
            border-radius: 5px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 10pt;
        }

        th, td {
            border: 1px solid #333;
            padding: 6px 4px;
            text-align: center;
            vertical-align: middle;
        }

        th {
            background: #e0e0e0;
            font-weight: bold;
            font-size: 9pt;
            white-space: nowrap;
        }

        /* Highlight non-3XL sizes in XXXL column (XS, 4XL+, youth, OSFA) */
        td.non-standard-xxxl {
            background-color: #fff3cd !important;  /* Light yellow */
            border: 2px solid #ffc107 !important;  /* Orange border */
            font-weight: bold !important;
        }

        td.non-standard-xxxl::after {
            content: " \\26A0";  /* Warning icon */
            color: #ff9800;
            font-size: 10pt;
        }

        td.text-left {
            text-align: left;
            padding-left: 8px;
        }

        .part-number {
            font-weight: bold;
            white-space: nowrap;
            font-size: 11pt;
        }

        .oversize-part {
            color: #d32f2f;
            background: #ffebee;
        }

        .row-even {
            background: #f9f9f9;
        }

        /* Fee rows styling — light blue background */
        .fee-row {
            background: #e3f2fd !important;
        }

        .fee-row td {
            border-color: #90caf9;
        }

        .totals {
            margin-top: 30px;
            border-top: 3px solid #000;
            padding-top: 15px;
            font-size: 12pt;
        }

        .totals p {
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
            max-width: 400px;
        }

        .totals .total-label {
            font-weight: bold;
        }

        .totals .grand-total {
            font-size: 14pt;
            font-weight: bold;
            color: #2d5f3f;
            border-top: 2px solid #000;
            padding-top: 10px;
            margin-top: 10px;
        }

        .checklist {
            margin-top: 25px;
            page-break-inside: avoid;
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
        }

        .checklist h3 {
            margin-top: 0;
            color: #2d5f3f;
        }

        .checklist h4 {
            margin: 15px 0 5px 0;
            color: #1565c0;
            font-size: 11pt;
        }

        .checklist ul {
            list-style: none;
            padding: 0;
            margin: 10px 0;
        }

        .checklist li {
            margin: 8px 0;
            padding-left: 25px;
            position: relative;
            font-size: 11pt;
        }

        .checklist li:before {
            content: '\\2610';
            position: absolute;
            left: 0;
            font-size: 14pt;
        }

        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 30px;
            background: #2d5f3f;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14pt;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 1000;
        }

        .print-button:hover {
            background: #1f4429;
        }

        .notes {
            margin-top: 20px;
            padding: 15px;
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            font-size: 10pt;
        }

        .notes h4 {
            margin: 0 0 10px 0;
            color: #1976d2;
        }
    </style>
</head>
<body>
    <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>

    <div class="header">
        <h1>SHOPWORKS DATA ENTRY GUIDE</h1>
        <h2>Quote ID: ${quoteID}</h2>
        <p><strong>Customer:</strong> ${customerName} | <strong>Date:</strong> ${today}</p>
        <p><strong>Total Pieces:</strong> ${totalQty} | <strong>Grand Total:</strong> $${total.toFixed(2)}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Line<br>Qty</th>
                <th>Part Number</th>
                <th>Color<br>Range</th>
                <th>Color</th>
                <th>Description</th>
                <th>S</th>
                <th>M</th>
                <th>LG</th>
                <th>XL</th>
                <th>XXL</th>
                <th>XXXL<br><span style="font-size: 8pt; font-weight: normal;">(Other)</span></th>
                <th>Manual<br>Price</th>
                <th>Calc.<br>Price</th>
                <th>Line<br>Total</th>
            </tr>
        </thead>
        <tbody>
            ${lineItems.map((item, idx) => `
                <tr class="${idx % 2 === 1 ? 'row-even' : ''}">
                    <td>${item.lineQty}</td>
                    <td class="part-number ${item.partNumber.includes('_') ? 'oversize-part' : ''}">${item.partNumber}</td>
                    <td>${item.colorRange}</td>
                    <td>${item.color}</td>
                    <td class="text-left">${item.description}</td>
                    <td>${item.sizes.S}</td>
                    <td>${item.sizes.M}</td>
                    <td>${item.sizes.LG}</td>
                    <td>${item.sizes.XL}</td>
                    <td>${item.sizes.XXL}</td>
                    <td class="${item.sizes.hasNonStandardXXXL ? 'non-standard-xxxl' : ''}">${item.sizes.XXXL}</td>
                    <td>$${item.manualPrice.toFixed(2)}</td>
                    <td>${item.calcPrice}</td>
                    <td>$${item.lineTotal.toFixed(2)}</td>
                </tr>
            `).join('')}
            ${feeRowsHTML}
        </tbody>
    </table>

    <div class="totals">
        <h3>VERIFY THESE TOTALS IN SHOPWORKS:</h3>
        <p><span class="total-label">Total Product Quantity:</span> <span>${totalQty}</span></p>
        <p><span class="total-label">Product Subtotal:</span> <span>$${productSubtotal.toFixed(2)}</span></p>
        ${feeItems.length > 0 ? `<p><span class="total-label">Fees &amp; Charges:</span> <span>$${feeSubtotal.toFixed(2)}</span></p>` : ''}
        <p><span class="total-label">Subtotal:</span> <span>$${subtotal.toFixed(2)}</span></p>
        ${tax > 0 ? `<p><span class="total-label">Sales Tax:</span> <span>$${tax.toFixed(2)}</span></p>` : ''}
        <p class="grand-total"><span class="total-label">GRAND TOTAL:</span> <span>$${total.toFixed(2)}</span></p>
    </div>

    <div class="checklist">
        <h3>DATA ENTRY CHECKLIST:</h3>
        <ul>
            ${lineItems.map(item =>
                `<li>Enter <strong>${item.partNumber}</strong> — ${item.description} (${item.lineQty} pcs × $${item.manualPrice.toFixed(2)})</li>`
            ).join('')}
        </ul>
        ${feeItems.length > 0 ? `
        <h4>Fees &amp; Charges:</h4>
        <ul>
            ${feeChecklistItems}
        </ul>
        ` : ''}
        <ul>
            <li>Verify all line totals match</li>
            <li>Verify grand total: <strong>$${total.toFixed(2)}</strong></li>
            <li>Set Calc. Price to <strong>Off</strong> for all lines</li>
        </ul>
    </div>

    ${quoteData.Notes ? `
    <div class="notes">
        <h4>QUOTE NOTES:</h4>
        <p>${quoteData.Notes}</p>
    </div>
    ` : ''}

</body>
</html>`;
    }
}

// Make available globally
window.ShopWorksGuideGenerator = ShopWorksGuideGenerator;
