// order-form-pdf.js - Generates a downloadable PDF quote from cart contents
console.log("[PDF-GEN:LOAD] Order form PDF generation module loaded (v2 - Enhanced Quote).");

(function() {
    "use strict";

    const LOGO_PLACEHOLDER_TEXT = "Northwest Custom Apparel"; // Placeholder if no image
    const COMPANY_INFO = "123 NWCA Lane, Tacoma, WA 98424 | (253) 922-5793 | sales@nwcustomapparel.com"; // Placeholder

    /**
     * Adds a header to the PDF page.
     * @param {jsPDF} doc - The jsPDF document instance.
     * @param {object} options - Header options (logo path, title).
     */
    function addHeader(doc, options = {}) {
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const margin = 15;

        // Placeholder for Logo (replace with image loading if available)
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(150); // Light gray for placeholder
        doc.text(LOGO_PLACEHOLDER_TEXT, margin, margin + 5);
        doc.setTextColor(0); // Reset color

        // Title
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text(options.title || "Quote", pageWidth / 2, margin + 7, { align: 'center' });

        // Date Generated
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const generatedDate = `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
        doc.text(generatedDate, pageWidth - margin, margin + 5, { align: 'right' });

        // Header line
        doc.setLineWidth(0.2);
        doc.line(margin, margin + 15, pageWidth - margin, margin + 15);

        return margin + 25; // Return starting Y position for content below header
    }

    /**
     * Adds a footer to the PDF page.
     * @param {jsPDF} doc - The jsPDF document instance.
     * @param {number} pageNumber - Current page number.
     * @param {number} totalPages - Total number of pages.
     */
    function addFooter(doc, pageNumber, totalPages) {
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const margin = 15;
        const footerY = pageHeight - margin;

        // Footer line
        doc.setLineWidth(0.2);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

        // Company Info
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(COMPANY_INFO, margin, footerY);

        // Page Number
        const pageNumText = `Page ${pageNumber} of ${totalPages}`;
        doc.text(pageNumText, pageWidth - margin, footerY, { align: 'right' });
    }

    /**
     * Formats currency values.
     * @param {number|string} amount - Amount to format.
     * @returns {string} - Formatted currency string (e.g., "$10.50").
     */
    function formatCurrency(amount) {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g,"")) : Number(amount);
        if (isNaN(numericAmount)) {
            return '$?.??';
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericAmount);
    }

    /**
     * Generates and triggers download of a quote PDF.
     * Assumes NWCACart is available globally.
     */
    async function generateQuotePDF() {
        console.log("[PDF-GEN:START] Starting Quote PDF generation...");
        const generateButton = document.getElementById('download-quote-pdf-btn'); // Use the new button ID
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.textContent = 'Generating...';
        }

        // Check for jsPDF and AutoTable
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            console.error("[PDF-GEN:ERROR] jsPDF library not found.");
            alert("Error: PDF library (jsPDF) not loaded correctly.");
            if (generateButton) { generateButton.disabled = false; generateButton.textContent = 'Download Quote PDF'; }
            return;
        }
        if (typeof jspdf.jsPDF.API?.autoTable === 'undefined') {
             console.error("[PDF-GEN:ERROR] jsPDF AutoTable plugin not found.");
             alert("Error: PDF Table plugin (jsPDF-AutoTable) not loaded correctly.");
             if (generateButton) { generateButton.disabled = false; generateButton.textContent = 'Download Quote PDF'; }
             return;
        }

        const { jsPDF } = jspdf;

        try {
            // 1. Get Cart Contents (Active Items)
            if (!window.NWCACart || typeof window.NWCACart.getCartItems !== 'function') {
                 // Check for the correct method getCartItems
                throw new Error("Cart system (NWCACart) or getCartItems method not available.");
            }
            // Fetch only 'Active' items for the quote
            const activeCartItems = window.NWCACart.getCartItems('Active');
            if (!activeCartItems || !Array.isArray(activeCartItems) || activeCartItems.length === 0) {
                alert("Your cart is empty or contains no active items. Add items before generating a quote.");
                throw new Error("Cart is empty or contains no active items.");
            }

            // 2. Initialize PDF Document
            const doc = new jsPDF();
            let yPos = addHeader(doc, { title: "Quote" }); // Add header and get starting Y

            // 3. Prepare Table Data
            const tableHeaders = ["Style Number", "Color", "Size", "Quantity", "Unit Price", "Line Total"];
            const tableBody = [];
            let subtotal = 0;
            let totalLtmFee = 0; // Calculate total LTM fee across all applicable types

            // Group items by embellishment type (using ImprintType from cart data) to calculate LTM correctly
            const itemsByEmbellishment = activeCartItems.reduce((acc, item) => {
                const type = item.ImprintType || 'Unknown'; // Use ImprintType from cart data
                if (!acc[type]) acc[type] = [];
                acc[type].push(item); // Push the original cart item structure
                return acc;
            }, {});

            // Calculate LTM fees per type
            const ltmFeesApplied = {};
            for (const type in itemsByEmbellishment) {
                const itemsOfType = itemsByEmbellishment[type];
                let quantityOfType = 0;
                itemsOfType.forEach(item => {
                    if (item.sizes && Array.isArray(item.sizes)) {
                        item.sizes.forEach(size => {
                            quantityOfType += parseInt(size.quantity) || 0;
                        });
                    }
                });
                if (quantityOfType > 0 && quantityOfType < 24) {
                    ltmFeesApplied[type] = 50.00; // $50 fee per type under 24
                    totalLtmFee += 50.00;
                }
            }

            // Populate table body using activeCartItems
            activeCartItems.forEach(item => {
                // Use original cart item structure (StyleNumber, Color, sizes array with Size, Quantity, UnitPrice)
                if (!item || !item.StyleNumber || !item.sizes || !Array.isArray(item.sizes) || item.sizes.length === 0) {
                    console.warn("[PDF-GEN:SKIP] Skipping invalid item:", item);
                    return;
                }

                const itemLtmFeeApplies = ltmFeesApplied[item.ImprintType || 'Unknown'] > 0;

                item.sizes.forEach(sizeDetail => {
                    // Use original size detail structure (Size, Quantity, UnitPrice)
                    if (!sizeDetail || typeof sizeDetail.Quantity === 'undefined') return;
                    const qty = parseInt(sizeDetail.Quantity) || 0;
                    if (qty === 0) return;

                    const unitPrice = parseFloat(sizeDetail.UnitPrice) || 0; // Use UnitPrice
                    // Calculate line total directly as Caspio might not provide it pre-calculated
                    const lineTotal = qty * unitPrice;
                    subtotal += lineTotal; // Add to subtotal

                    tableBody.push([
                        item.StyleNumber || 'N/A', // Use StyleNumber
                        item.Color || 'N/A',       // Use Color
                        sizeDetail.Size || 'N/A',   // Use Size
                        qty,                        // Use parsed quantity
                        formatCurrency(unitPrice),  // Use UnitPrice
                        formatCurrency(lineTotal)   // Use calculated line total
                    ]);
                });
            });

            // Adjust subtotal if LTM fees were included in line totals
            // Note: This assumes line totals *already include* the distributed LTM fee.
            // If line totals are base price, subtotal calculation needs adjustment.
            // For simplicity, we'll assume line totals are final and calculate subtotal from them.
            // The displayed LTM fee below will be the total fee amount.

            // 4. Add Items Table
            if (tableBody.length > 0) {
                doc.autoTable({
                    head: [tableHeaders],
                    body: tableBody,
                    startY: yPos,
                    theme: 'grid',
                    headStyles: { fillColor: [0, 86, 179], textColor: 255, fontStyle: 'bold' }, // NWCA Blue Header
                    styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
                    columnStyles: {
                        0: { cellWidth: 30 }, // Style
                        1: { cellWidth: 35 }, // Color
                        2: { cellWidth: 20 }, // Size
                        3: { cellWidth: 20, halign: 'right' }, // Quantity
                        4: { cellWidth: 30, halign: 'right' }, // Unit Price
                        5: { cellWidth: 30, halign: 'right' }  // Line Total
                    },
                    didDrawPage: function (data) {
                        // Add Footer to each page
                        addFooter(doc, data.pageNumber, doc.internal.getNumberOfPages());
                    }
                });
                yPos = doc.lastAutoTable.finalY + 10; // Update yPos after table
            } else {
                 doc.text("No items with quantity found in the cart.", 15, yPos);
                 yPos += 10;
            }

            // 5. Add Summary Section
            const summaryX = 140; // X position for summary labels/values
            const summaryWidth = 55; // Width for alignment
            const grandTotal = subtotal; // Grand total is the sum of line totals

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');

            // Subtotal (calculated from line totals)
            // doc.text("Subtotal:", summaryX, yPos, { align: 'right', maxWidth: summaryWidth });
            // doc.text(formatCurrency(subtotal - totalLtmFee), summaryX + summaryWidth, yPos, { align: 'right' }); // If line totals include LTM
            // yPos += 6;

            // Less Than Minimum Fee
            if (totalLtmFee > 0) {
                doc.setTextColor(220, 53, 69); // Red for LTM
                doc.text("Less Than Minimum Fee:", summaryX, yPos, { align: 'right', maxWidth: summaryWidth });
                doc.text(formatCurrency(totalLtmFee), summaryX + summaryWidth, yPos, { align: 'right' });
                doc.setTextColor(0); // Reset color
                yPos += 6;
            }

            // Grand Total
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text("Grand Total:", summaryX, yPos, { align: 'right', maxWidth: summaryWidth });
            doc.text(formatCurrency(grandTotal), summaryX + summaryWidth, yPos, { align: 'right' });
            yPos += 10;

            // 6. Save PDF
            const filename = `NWCA_Quote_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            console.log(`[PDF-GEN:SUCCESS] Quote PDF "${filename}" generated.`);
            alert(`Quote PDF "${filename}" has been generated.`);

        } catch (error) {
            console.error("[PDF-GEN:ERROR] Failed to generate Quote PDF:", error);
            alert(`Error generating Quote PDF: ${error.message}`);
        } finally {
            // Re-enable button
            if (generateButton) {
                generateButton.disabled = false;
                generateButton.textContent = 'Download Quote PDF'; // Update text
            }
        }
    }

    // Expose the generation function globally
    window.NWCAOrderFormPDF = {
        generate: generateQuotePDF // Point to the new function name
    };

})();