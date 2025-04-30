// order-form-pdf.js - Generates a downloadable PDF order form from cart contents

console.log("[PDF-GEN:LOAD] Order form PDF generation module loaded.");

(function() {
    "use strict";

    /**
     * Generates and triggers download of an order form PDF.
     * Assumes NWCACart and nwcaPricingData are available globally.
     */
    async function generateOrderFormPDF() {
        console.log("[PDF-GEN:START] Starting PDF generation...");
        const generateButton = document.getElementById('download-order-pdf-button');
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.textContent = 'Generating...';
        }

        // Check for jsPDF and AutoTable just before generation
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            console.error("[PDF-GEN:ERROR] jsPDF library not found.");
            alert("Error: PDF library (jsPDF) not loaded correctly.");
            if (generateButton) { generateButton.disabled = false; generateButton.textContent = 'Download Order PDF'; }
            return;
        }
        // Check specifically for the autoTable method on the prototype
        // Use optional chaining ?. for safety
        if (typeof jspdf.jsPDF.API?.autoTable === 'undefined') {
             console.error("[PDF-GEN:ERROR] jsPDF AutoTable plugin not found or not attached correctly.");
             alert("Error: PDF Table plugin (jsPDF-AutoTable) not loaded correctly.");
             if (generateButton) { generateButton.disabled = false; generateButton.textContent = 'Download Order PDF'; }
             return;
        }

        const { jsPDF } = jspdf; // Destructure jsPDF

        try {
            // 1. Get Cart Contents
            if (!window.NWCACart || typeof window.NWCACart.getCartContents !== 'function') {
                throw new Error("Cart system (NWCACart) not available.");
            }
            const cartContents = window.NWCACart.getCartContents();
            if (!cartContents || !cartContents.items || cartContents.items.length === 0) {
                alert("Your cart is empty. Add items before generating an order form.");
                throw new Error("Cart is empty.");
            }

            // 2. Initialize PDF Document
            const doc = new jsPDF();
            let yPos = 15; // Initial Y position for content

            // --- PDF Header ---
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text("Order Form - Northwest Custom Apparel", 14, yPos);
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, yPos);
            yPos += 8;

            // --- Customer Name Field ---
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text("Customer Name:", 14, yPos);
            doc.setLineWidth(0.5);
            doc.line(50, yPos, 190, yPos); // Line for name input
            yPos += 10;

            // --- Iterate Through Cart Items ---
            for (const item of cartContents.items) {
                if (!item || !item.styleNumber || !item.sizes || item.sizes.length === 0) {
                    console.warn("[PDF-GEN:SKIP] Skipping invalid item:", item);
                    continue;
                }

                // --- Item Header ---
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text(`Style: ${item.styleNumber}`, 14, yPos);
                yPos += 6;
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');
                doc.text(`Color: ${item.color || 'N/A'}`, 14, yPos);
                doc.text(`Embellishment: ${item.embellishmentType || 'N/A'}`, 100, yPos);
                yPos += 8;

                // --- Pricing Tier Info ---
                const pricingInfo = item.pricingInfo || {}; // Get pricing info stored with the item
                doc.setFontSize(10);
                doc.text(`Pricing Tier Used: ${pricingInfo.tierKey || 'N/A'}`, 14, yPos);
                if (pricingInfo.ltmFeeApplied) {
                    doc.setTextColor(220, 53, 69); // Red color for LTM warning
                    doc.text(`LTM Fee Applied ($${(pricingInfo.ltmFeeTotal || 0).toFixed(2)} total / $${(pricingInfo.ltmFeePerItem || 0).toFixed(2)} per item)`, 70, yPos);
                    doc.setTextColor(0); // Reset color
                }
                yPos += 6;

                // --- Size/Quantity/Price Matrix ---
                const tableHeaders = ["Size", "Quantity", "Unit Price", "Item Total"];
                const tableBody = item.sizes.map(sizeDetail => {
                    if (!sizeDetail || typeof sizeDetail.quantity === 'undefined') return null; // Skip invalid size details
                    const qty = parseInt(sizeDetail.quantity) || 0;
                    if (qty === 0) return null; // Skip sizes with 0 quantity

                    const unitPrice = parseFloat(sizeDetail.unitPrice) || 0; // Price including LTM if applicable
                    const itemTotal = parseFloat(sizeDetail.totalPrice) || (qty * unitPrice); // Use stored total or recalculate

                    return [
                        sizeDetail.size || 'N/A',
                        qty,
                        `$${unitPrice.toFixed(2)}`,
                        `$${itemTotal.toFixed(2)}`
                    ];
                }).filter(row => row !== null); // Remove null rows

                if (tableBody.length > 0) {
                    doc.autoTable({
                        head: [tableHeaders],
                        body: tableBody,
                        startY: yPos,
                        theme: 'grid',
                        headStyles: { fillColor: [0, 86, 179] }, // NWCA Blue
                        styles: { fontSize: 9, cellPadding: 1.5 },
                        columnStyles: {
                            0: { cellWidth: 30 }, // Size
                            1: { cellWidth: 30, halign: 'right' }, // Quantity
                            2: { cellWidth: 40, halign: 'right' }, // Unit Price
                            3: { cellWidth: 40, halign: 'right' }  // Item Total
                        }
                    });
                    yPos = doc.lastAutoTable.finalY + 10; // Update yPos after table
                } else {
                     doc.text("No quantities entered for this item.", 14, yPos);
                     yPos += 6;
                }

                 // Add space between items
                 yPos += 5;
                 doc.setLineWidth(0.1);
                 doc.line(14, yPos, 196, yPos); // Separator line
                 yPos += 10;

                 // Check for page break
                 if (yPos > 270) {
                     doc.addPage();
                     yPos = 15;
                 }
            }

            // --- Grand Totals ---
            let grandTotal = 0;
            cartContents.items.forEach(item => {
                 if (item && item.sizes) {
                     item.sizes.forEach(sizeDetail => {
                         grandTotal += parseFloat(sizeDetail.totalPrice) || 0;
                     });
                 }
            });

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`Grand Total: $${grandTotal.toFixed(2)}`, 196, yPos, { align: 'right' }); // Align right
            yPos += 10;


            // --- Save PDF ---
            const filename = `NWCA_Order_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            console.log(`[PDF-GEN:SUCCESS] PDF "${filename}" generated.`);
            alert(`Order form PDF "${filename}" has been generated.`);

        } catch (error) {
            console.error("[PDF-GEN:ERROR] Failed to generate PDF:", error);
            alert(`Error generating PDF: ${error.message}`);
        } finally {
            // Re-enable button
            if (generateButton) {
                generateButton.disabled = false;
                generateButton.textContent = 'Download Order PDF';
            }
        }
    }

    // Expose the generation function globally
    window.NWCAOrderFormPDF = {
        generate: generateOrderFormPDF
    };

})();