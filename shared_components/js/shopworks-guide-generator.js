/**
 * ShopWorks Data Entry Guide Generator
 * Generates a printable HTML/PDF document showing exactly how to enter
 * embroidery quotes into ShopWorks with correct part numbers and formatting.
 *
 * CRITICAL: Uses _2X format (NOT _2XL) for oversize part numbers to match ShopWorks inventory
 */

class ShopWorksGuideGenerator {
    constructor() {
        // Part number suffix mapping (ShopWorks format)
        // IMPORTANT: ShopWorks uses _2X not _2XL!
        this.partNumberSuffixMap = {
            // Standard sizes: NO suffix
            'S': '',
            'M': '',
            'L': '',
            'XL': '',
            // Oversizes: _2X format (shortened from SanMar's _2XL)
            '2XL': '_2X',
            '3XL': '_3X',
            '4XL': '_4X',
            '5XL': '_5X',
            '6XL': '_6X',
            '7XL': '_7X',
            '8XL': '_8X',
            '9XL': '_9X',
            '10XL': '_10X',
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

        console.log('[ShopWorksGuide] Generator initialized');
    }

    /**
     * Generate ShopWorks entry guide from quote data
     * Opens in new window with print dialog
     */
    generateGuide(quoteData) {
        console.log('[ShopWorksGuide] Generating guide for:', quoteData);

        try {
            // Parse quote data into ShopWorks line items
            const lineItems = this.parseQuoteIntoLineItems(quoteData);
            console.log('[ShopWorksGuide] Parsed into line items:', lineItems);

            // Generate HTML document
            const html = this.generateHTML(lineItems, quoteData);

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

            console.log('[ShopWorksGuide] Guide opened in new window');

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
                    description: product.ProductName || product.productName || '',
                    sizes: this.formatSizesForShopWorks(standardSizes),
                    manualPrice: parseFloat(product.BaseUnitPrice || product.FinalUnitPrice || 0),
                    calcPrice: 'On',
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
                    description: product.ProductName || product.productName || '',
                    sizes: this.formatSizesForShopWorks({ [size]: qty }),
                    manualPrice: this.getPriceForSize(size, product),
                    calcPrice: 'On',
                    lineTotal: qty * this.getPriceForSize(size, product)
                });
            });
        });

        return items;
    }

    /**
     * Format sizes into ShopWorks column structure
     */
    formatSizesForShopWorks(sizeBreakdown) {
        const shopWorksFormat = {
            Adult: '',
            S: '',
            M: '',
            LG: '',
            XL: '',
            XXL: '',
            XXXL: '',
            Other: ''
        };

        Object.entries(sizeBreakdown).forEach(([size, qty]) => {
            const column = this.getSizeColumn(size);
            if (column && shopWorksFormat.hasOwnProperty(column)) {
                shopWorksFormat[column] = qty || '';
            }
        });

        return shopWorksFormat;
    }

    /**
     * Map size to ShopWorks column name
     */
    getSizeColumn(size) {
        const sizeUpper = size.toUpperCase();

        const columnMap = {
            'S': 'S',
            'M': 'M',
            'L': 'LG',      // ShopWorks uses "LG" not "L"
            'XL': 'XL',
            '2XL': 'XXL',   // 2XL goes in XXL column
            '3XL': 'XXXL',  // 3XL goes in XXXL column
            '4XL': 'Other', // 4XL and beyond go in "Other"
            '5XL': 'Other',
            '6XL': 'Other',
            '7XL': 'Other',
            '8XL': 'Other',
            '9XL': 'Other',
            '10XL': 'Other',
            'OSFA': 'Other'
        };

        return columnMap[sizeUpper] || 'Other';
    }

    /**
     * Calculate line total for a group of sizes
     */
    calculateLineTotal(sizes, product) {
        const totalQty = Object.values(sizes).reduce((a, b) => a + b, 0);
        const price = parseFloat(product.BaseUnitPrice || product.FinalUnitPrice || 0);
        return totalQty * price;
    }

    /**
     * Get price for specific size (handles size upcharges if needed)
     */
    getPriceForSize(size, product) {
        // For now, use base price for all sizes
        // Could enhance later to pull size-specific pricing if available
        return parseFloat(product.BaseUnitPrice || product.FinalUnitPrice || 0);
    }

    /**
     * Generate HTML document
     */
    generateHTML(lineItems, quoteData) {
        const today = new Date().toLocaleDateString();
        const customerName = quoteData.CustomerName || quoteData.customerName || 'Customer';
        const quoteID = quoteData.QuoteID || quoteData.quoteID || 'N/A';
        const totalQty = quoteData.TotalQuantity || lineItems.reduce((sum, item) => sum + item.lineQty, 0);
        const subtotal = quoteData.SubtotalAmount || lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
        const total = quoteData.TotalAmount || subtotal;
        const tax = total - subtotal;

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
            content: '☐';
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
    <button class="print-button no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>

    <div class="header">
        <h1>SHOPWORKS DATA ENTRY GUIDE</h1>
        <h2>Quote ID: ${quoteID}</h2>
        <p><strong>Customer:</strong> ${customerName} | <strong>Date:</strong> ${today}</p>
        <p><strong>Total Pieces:</strong> ${totalQty} | <strong>Grand Total:</strong> $${total.toFixed(2)}</p>
    </div>

    <div class="warning">
        ⚠️ CRITICAL: Use part numbers EXACTLY as shown below!<br>
        Oversizes use _2X format (NOT _2XL) • 4XL and beyond go in "Other" column
    </div>

    <table>
        <thead>
            <tr>
                <th>Line<br>Qty</th>
                <th>Part Number</th>
                <th>Color<br>Range</th>
                <th>Color</th>
                <th>Description</th>
                <th>Adult</th>
                <th>S</th>
                <th>M</th>
                <th>LG</th>
                <th>XL</th>
                <th>XXL</th>
                <th>XXXL</th>
                <th>Other</th>
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
                    <td>${item.sizes.Adult}</td>
                    <td>${item.sizes.S}</td>
                    <td>${item.sizes.M}</td>
                    <td>${item.sizes.LG}</td>
                    <td>${item.sizes.XL}</td>
                    <td>${item.sizes.XXL}</td>
                    <td>${item.sizes.XXXL}</td>
                    <td>${item.sizes.Other}</td>
                    <td>$${item.manualPrice.toFixed(2)}</td>
                    <td>${item.calcPrice}</td>
                    <td>$${item.lineTotal.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="totals">
        <h3>VERIFY THESE TOTALS IN SHOPWORKS:</h3>
        <p><span class="total-label">Total Product Quantity:</span> <span>${totalQty}</span></p>
        <p><span class="total-label">Total Pricing Quantity:</span> <span>${totalQty}</span></p>
        <p><span class="total-label">Subtotal:</span> <span>$${subtotal.toFixed(2)}</span></p>
        ${tax > 0 ? `<p><span class="total-label">Sales Tax:</span> <span>$${tax.toFixed(2)}</span></p>` : ''}
        <p class="grand-total"><span class="total-label">GRAND TOTAL:</span> <span>$${total.toFixed(2)}</span></p>
    </div>

    <div class="checklist">
        <h3>📋 ENTRY CHECKLIST</h3>
        <ul>
            <li>All ${lineItems.length} lines entered into ShopWorks</li>
            <li>Part numbers match exactly (check _2X vs _2XL!)</li>
            <li>Line Qty matches size column totals for each row</li>
            <li>Colors correct on all lines</li>
            <li>Sizes in correct columns (4XL+ in "Other")</li>
            <li>Manual prices entered correctly</li>
            <li>Calc. Price toggle set to "On"</li>
            <li>Line totals calculate correctly</li>
            <li>Overall grand total matches: $${total.toFixed(2)}</li>
        </ul>
    </div>

    ${quoteData.Notes ? `
    <div class="notes">
        <h4>📝 QUOTE NOTES:</h4>
        <p>${quoteData.Notes}</p>
    </div>
    ` : ''}

    <script>
        // Auto-print when page loads (after brief delay for rendering)
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</body>
</html>`;
    }
}

// Make available globally
window.ShopWorksGuideGenerator = ShopWorksGuideGenerator;

console.log('[ShopWorksGuide] Service loaded successfully');
