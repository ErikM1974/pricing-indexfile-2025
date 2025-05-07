// order-form-pdf.js - Generates a downloadable PDF quote from cart contents
console.log("[PDF-GEN:LOAD] Order form PDF generation module loaded (v2 - Enhanced Quote).");

(function() {
    "use strict";

    // Company information
    const COMPANY_LOGO_URL = "https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1";
    const COMPANY_NAME = "Northwest Custom Apparel";
    const COMPANY_ADDRESS = "2025 Freeman Road East Milton, WA 98354";
    const COMPANY_PHONE = "253-922-5793";
    const COMPANY_WEBSITE = "www.nwcustomapparel.com";
    const COMPANY_EMAIL = "sales@nwcustomapparel.com";
    const COMPANY_INFO = `${COMPANY_ADDRESS} | ${COMPANY_PHONE} | ${COMPANY_EMAIL}`;

    /**
     * Adds a header to the PDF page.
     * @param {jsPDF} doc - The jsPDF document instance.
     * @param {object} options - Header options (logo path, title).
     */
    /**
     * Loads an image and returns a promise that resolves with the base64 data
     * @param {string} url - The URL of the image to load
     * @returns {Promise<string>} - Promise resolving with base64 data
     */
    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";  // Handle CORS if needed
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                try {
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (e) {
                    reject(new Error("Failed to convert image to data URL: " + e.message));
                }
            };
            img.onerror = function() {
                reject(new Error("Failed to load image via proxy from URL: " + url)); // Updated error message
            };
            // Construct the proxy URL
            const encodedUrl = encodeURIComponent(url);
            const proxyUrl = `/api/image-proxy?url=${encodedUrl}`;
            console.log(`[PDF-GEN:IMG] Loading image via proxy: ${proxyUrl}`); // Log proxy usage
            img.src = proxyUrl; // Use the proxy URL
        });
    }

    /**
     * Adds a header to the PDF page.
     * @param {jsPDF} doc - The jsPDF document instance.
     * @param {object} options - Header options (logo path, title).
     */
    async function addHeader(doc, options = {}) {
            const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
            const margin = 15;
            
            try {
                // Add company logo with more compact proportions
                const logoData = await loadImage(COMPANY_LOGO_URL);
                const logoHeight = 20; // Further reduced height
                const logoWidth = 48; // Further reduced width
                doc.addImage(logoData, 'PNG', margin, margin, logoWidth, logoHeight);
            } catch (error) {
                console.error("[PDF-GEN:ERROR] Failed to load logo:", error);
                // Fallback to text if image fails to load
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(COMPANY_NAME, margin, margin + 10);
            }
    
            // Title with slightly smaller font
            doc.setFontSize(18); // Reduced from 22
            doc.setFont(undefined, 'bold');
            doc.text("Quote", pageWidth / 2, margin + 12, { align: 'center' });
    
            // Quote Number and Date - more compact
            doc.setFontSize(9); // Reduced from 10
            doc.setFont(undefined, 'normal');
            const quoteNumber = `Quote #: Q-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const generatedDate = `Date: ${new Date().toLocaleDateString()}`;
            const validUntil = `Valid Until: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}`; // 30 days from now
            
            // Quote details aligned right
            doc.text(quoteNumber, pageWidth - margin, margin + 5, { align: 'right' });
            doc.text(generatedDate, pageWidth - margin, margin + 10, { align: 'right' });
            doc.text(validUntil, pageWidth - margin, margin + 15, { align: 'right' });
            
            // Header line
            doc.setLineWidth(0.1); // Thinner line
            doc.line(margin, margin + 30, pageWidth - margin, margin + 30);
    
            // Return starting Y position for content below header
            return margin + 36; // Less padding after header
    }

    /**
     * Adds a footer to the PDF page.
     * @param {jsPDF} doc - The jsPDF document instance.
     * @param {number} pageNumber - Current page number.
     * @param {number} totalPages - Total number of pages.
     */
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
        doc.setLineWidth(0.1); // Thinner line
        doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

        // Company Info - more compact
        doc.setFontSize(7); // Reduced from 8
        doc.setFont(undefined, 'normal');
        const fullCompanyInfo = `${COMPANY_ADDRESS} | Ph: ${COMPANY_PHONE} | Em: ${COMPANY_EMAIL} | Web: ${COMPANY_WEBSITE}`;
        doc.text(fullCompanyInfo, margin, footerY - 4);

        // Mini disclaimer
        doc.setFontSize(6); // Very small text
        doc.text("Prices subject to change. Shipping and taxes not included.", margin, footerY);

        // Page Number
        doc.setFontSize(7);
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
     * Sorts sizes in standard apparel order.
     * @param {Array} sizes - Array of size objects.
     * @returns {Array} - Sorted array of size objects.
     */
    function sortSizes(sizes) {
        const sizeOrder = {
            'S': 10,
            'M': 20,
            'L': 30,
            'XL': 40,
            '2XL': 50,
            '3XL': 60,
            '4XL': 70,
            '5XL': 80
        };
        
        return [...sizes].sort((a, b) => {
            const sizeA = a.size || a.Size;
            const sizeB = b.size || b.Size;
            
            // Use the defined order or default to 100 (end) if size not found
            return (sizeOrder[sizeA] || 100) - (sizeOrder[sizeB] || 100);
        });
    }

    /**
     * Generates and triggers download of a quote PDF.
     * Assumes NWCACart is available globally.
     */
    /**
     * Adds product images to the PDF.
     * @param {jsPDF} doc - The jsPDF document instance.
     * @param {Array} items - Cart items with image URLs.
     * @param {number} startY - Starting Y position.
     * @returns {Promise<number>} - Promise resolving with the new Y position after adding images.
     */
    async function addProductImages(doc, items, startY) {
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = startY;
        
        // Add section title
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text("Product Images", margin, yPos);
        yPos += 10;
        
        // Set up improved image grid parameters (larger images, better spacing)
        const imageWidth = 70; // Slightly larger images
        const imageHeight = 70;
        const imagesPerRow = 2; // 2 images per row for better layout
        const horizontalSpacing = (pageWidth - 2 * margin - imagesPerRow * imageWidth) / (imagesPerRow - 1);
        const verticalSpacing = 5; // Reduced vertical spacing
        const captionHeight = 25; // Slightly smaller caption area
        
        // Get unique products (by StyleNumber and Color)
        const uniqueProducts = [];
        const uniqueKeys = new Set();
        
        items.forEach(item => {
            if (!item.StyleNumber || !item.Color) return;
            
            const key = `${item.StyleNumber}-${item.Color}`;
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                uniqueProducts.push(item);
            }
        });
        
        // Add images in a grid layout
        let currentX = margin;
        let currentY = yPos;
        let itemsInCurrentRow = 0;
        
        for (let i = 0; i < uniqueProducts.length; i++) {
            const item = uniqueProducts[i];
            
            // Check if we need to start a new row
            if (itemsInCurrentRow === imagesPerRow) {
                currentX = margin;
                currentY += imageHeight + captionHeight + verticalSpacing;
                itemsInCurrentRow = 0;
            }
            
            // Check if we need to start a new page
            if (currentY + imageHeight + captionHeight > pageHeight - margin) {
                doc.addPage();
                addFooter(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages());
                currentY = margin + 20;
                currentX = margin;
                itemsInCurrentRow = 0;
            }
            
            // Try to add the image if available
            if (item.imageUrl) {
                try {
                    const imageData = await loadImage(item.imageUrl);
                    doc.addImage(imageData, 'JPEG', currentX, currentY, imageWidth, imageHeight);
                } catch (error) {
                    console.warn(`[PDF-GEN:WARN] Failed to load image for ${item.StyleNumber}:`, error);
                    // Draw a placeholder rectangle
                    doc.setDrawColor(200);
                    doc.setFillColor(240);
                    doc.rect(currentX, currentY, imageWidth, imageHeight, 'FD');
                    doc.setFontSize(8);
                    doc.setTextColor(100);
                    doc.text("Image Not Available", currentX + imageWidth/2, currentY + imageHeight/2, { align: 'center' });
                    doc.setTextColor(0);
                }
            } else {
                // Draw a placeholder rectangle
                doc.setDrawColor(200);
                doc.setFillColor(240);
                doc.rect(currentX, currentY, imageWidth, imageHeight, 'FD');
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text("No Image", currentX + imageWidth/2, currentY + imageHeight/2, { align: 'center' });
                doc.setTextColor(0);
            }
            
            // Add caption with style number, color, and pricing - more compact
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.text(item.StyleNumber || 'N/A', currentX + imageWidth/2, currentY + imageHeight + 5, { align: 'center' });
            doc.setFont(undefined, 'normal');
            doc.text(item.Color || 'N/A', currentX + imageWidth/2, currentY + imageHeight + 12, { align: 'center' });
            
            // Add pricing information
            const unitPrice = item.sizes && item.sizes[0] ? item.sizes[0].UnitPrice : 'N/A';
            const priceText = unitPrice !== 'N/A' ? formatCurrency(unitPrice) : 'Price: N/A';
            doc.setFontSize(7);
            doc.text(priceText, currentX + imageWidth/2, currentY + imageHeight + 18, { align: 'center' });
            
            // Move to next position
            currentX += imageWidth + horizontalSpacing;
            itemsInCurrentRow++;
        }
        
        // Return the new Y position
        return currentY + imageHeight + captionHeight + 10;
    }

    /**
     * Adds embellishment information to the PDF.
     * This function is maintained for backward compatibility but has been
     * replaced by inline embellishment info in the main generation function.
     */
    function addEmbellishmentInfo(doc, items, startY) {
        console.log("[PDF-GEN:INFO] Using inline embellishment info instead of separate section");
        // This function is now just a stub - embellishment info is handled inline
        return startY;
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

            // 2. Initialize PDF Document (Portrait for better fitting)
            const doc = new jsPDF();
            console.log("[PDF-GEN:INFO] Creating 2-page professional quote layout");
            let yPos = await addHeader(doc, { title: "Quote" }); // Simplified title

            // 3. Prepare Table Data
            const tableHeaders = ["Style Number", "Color", "Embellishment", "Size", "Quantity", "Unit Price", "Line Total"];
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
                        item.StyleNumber || 'N/A',    // Use StyleNumber
                        item.Color || 'N/A',          // Use Color
                        item.ImprintType || 'N/A',    // Add embellishment type
                        sizeDetail.Size || 'N/A',     // Use Size
                        qty,                          // Use parsed quantity
                        formatCurrency(unitPrice),    // Use UnitPrice
                        formatCurrency(lineTotal)     // Use calculated line total
                    ]);
                });
            });

            // Adjust subtotal if LTM fees were included in line totals
            // Note: This assumes line totals *already include* the distributed LTM fee.
            // If line totals are base price, subtotal calculation needs adjustment.
            // For simplicity, we'll assume line totals are final and calculate subtotal from them.
            // The displayed LTM fee below will be the total fee amount.

            // Group items by style number to make the table more compact
            const groupedTableBody = [];
            const groupedItems = {};
            
            tableBody.forEach(row => {
                const styleNumber = row[0];
                const color = row[1];
                const embellishment = row[2];
                const styleColorEmb = `${styleNumber}-${color}-${embellishment}`;
                
                if (!groupedItems[styleColorEmb]) {
                    groupedItems[styleColorEmb] = {
                        styleNumber,
                        color,
                        embellishment,
                        sizes: []
                    };
                }
                
                groupedItems[styleColorEmb].sizes.push({
                    size: row[3],
                    quantity: row[4],
                    unitPrice: row[5],
                    lineTotal: row[6]
                });
            });
            
            // Create grouped table rows
            Object.values(groupedItems).forEach(item => {
                // Sort sizes in standard order (S, M, L, XL, 2XL, etc.)
                const sortedSizes = sortSizes(item.sizes);
                
                // For each size, show the style number, color, and embellishment
                sortedSizes.forEach((size, index) => {
                    groupedTableBody.push([
                        item.styleNumber, // Always show style number
                        item.color,       // Always show color
                        item.embellishment, // Always show embellishment
                        size.size,
                        size.quantity,
                        size.unitPrice,
                        size.lineTotal
                    ]);
                });
                
                // Add a subtle separator row after each style group (except the last one)
                if (sortedSizes.length > 0) {
                    // Use a lightweight separator instead of a completely empty row
                    groupedTableBody.push([
                        "---", "", "", "", "", "", ""
                    ]);
                }
            });
            
            // Remove the last separator row if it exists (to prevent extra space at the end)
            if (groupedTableBody.length > 0 && groupedTableBody[groupedTableBody.length-1][0] === "---") {
                groupedTableBody.pop();
            }

            // 4. Add Items Table with modern styling
            if (groupedTableBody.length > 0) {
                const tableStartY = yPos;
                doc.autoTable({
                    head: [tableHeaders],
                    body: groupedTableBody,
                    startY: tableStartY,
                    margin: { left: 15, right: 15 }, // Use standard margins
                    theme: 'striped', // Use striped theme for modern look
                    headStyles: {
                        fillColor: [41, 128, 185], // Professional blue
                        textColor: 255,
                        fontStyle: 'bold',
                        fontSize: 9, // Slightly larger header font
                        halign: 'center'
                    },
                    styles: {
                        fontSize: 8,
                        font: 'helvetica', // Consistent font
                        cellPadding: 3, // More padding
                        valign: 'middle',
                        lineWidth: 0.1,
                        lineColor: [220, 220, 220] // Lighter grid lines
                    },
                    alternateRowStyles: {
                        fillColor: [245, 245, 245] // Light gray for striping
                    },
                    // Custom styling for separator rows (now handled differently)
                    willDrawCell: function(data) {
                        // Remove the visual separator row content if it exists
                        if (data.row.raw[0] === "---") {
                            // Instead of drawing text, maybe draw a thin line or just skip
                            // For now, let's just make the text white to hide it
                            doc.setTextColor(255, 255, 255);
                            // Or prevent drawing the cell content entirely if possible
                        }
                    },
                    didParseCell: function(data) {
                        // Hide the separator row content cleanly
                         if (data.row.raw[0] === "---") {
                             data.cell.text = ''; // Clear text
                             // Optionally set styles to make it blend
                             data.cell.styles.fillColor = '#ffffff'; // White background
                             data.cell.styles.lineWidth = 0; // No border
                         }
                    },
                    columnStyles: {
                        // Adjust widths for better balance - total width approx 180 (pageWidth - 2*margin)
                        0: { cellWidth: 25, fontStyle: 'bold' }, // Style (slightly wider, bold)
                        1: { cellWidth: 25 },                  // Color
                        2: { cellWidth: 30 },                  // Embellishment
                        3: { cellWidth: 15, halign: 'center' }, // Size (centered)
                        4: { cellWidth: 20, halign: 'right' }, // Quantity
                        5: { cellWidth: 30, halign: 'right' }, // Unit Price
                        6: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } // Line Total (wider, bold)
                    },
                    didDrawPage: function (data) {
                        addFooter(doc, data.pageNumber, doc.internal.getNumberOfPages());
                    }
                });
                yPos = doc.lastAutoTable.finalY + 10; // More spacing after table
            } else {
                 doc.text("No items with quantity found in the cart.", 15, yPos);
                 yPos += 10;
            }

            // --- Summary Section ---
            const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
            const margin = 15; // Ensure margin is defined in this scope
            const summaryStartY = yPos;
            const summaryBlockWidth = 70; // Width of the summary block
            const summaryBlockX = pageWidth - margin - summaryBlockWidth; // Align to right
            const summaryLineHeight = 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            // Sub Total
            doc.text("Sub Total:", summaryBlockX, summaryStartY);
            doc.text(formatCurrency(subtotal), summaryBlockX + summaryBlockWidth, summaryStartY, { align: 'right' });
            yPos = summaryStartY + summaryLineHeight;

            // Less Than Minimum Fee
            if (totalLtmFee > 0) {
                doc.setTextColor(220, 53, 69); // Red for LTM
                doc.text("Less Than Minimum Fee:", summaryBlockX, yPos);
                doc.text(formatCurrency(totalLtmFee), summaryBlockX + summaryBlockWidth, yPos, { align: 'right' });
                doc.setTextColor(0); // Reset color
                yPos += summaryLineHeight;
            }

            // Separator Line before Final Total (if needed, or just use spacing)
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.2);
            doc.line(summaryBlockX, yPos, summaryBlockX + summaryBlockWidth, yPos);
            yPos += 3; // Space after line

            // Final Total (Currently same as Subtotal, adjust if taxes/shipping added later)
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text("Total:", summaryBlockX, yPos);
            doc.text(formatCurrency(subtotal + totalLtmFee), summaryBlockX + summaryBlockWidth, yPos, { align: 'right' });
            yPos += summaryLineHeight + 2; // Extra space after total

            // --- Embellishment Info (Below Summary or elsewhere if needed) ---
            const embX = margin; // Position on left
            let embY = summaryStartY; // Align top with summary block

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text("Embellishment Information:", embX, embY);
            embY += summaryLineHeight;

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const embellishmentTypes = {};
            activeCartItems.forEach(item => {
                const type = item.ImprintType || 'Unknown';
                if (!embellishmentTypes[type]) embellishmentTypes[type] = { count: 0, quantity: 0 };
                embellishmentTypes[type].count++; // Count unique items per type if needed, or just total quantity
                if (item.sizes && Array.isArray(item.sizes)) {
                    item.sizes.forEach(size => {
                        embellishmentTypes[type].quantity += parseInt(size.Quantity) || 0;
                    });
                }
            });

            for (const type in embellishmentTypes) {
                 doc.text(`${type}: ${embellishmentTypes[type].quantity} pcs`, embX, embY);
                 embY += summaryLineHeight -1; // Tighter spacing
            }

            // Ensure yPos is below both summary and embellishment info
            yPos = Math.max(yPos, embY) + 10; // Space before terms

            // --- Terms and Conditions ---
            const termsStartY = yPos;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text("Terms and Conditions", margin, termsStartY);
            yPos = termsStartY + 5;

            doc.setFontSize(7); // Smaller font for terms
            doc.setFont('helvetica', 'normal');
            const terms = "This quote is valid for 30 days from the date of issue. Prices are subject to change without notice after the validity period. " +
                          "Shipping, taxes, and additional fees are not included in this quote. Production time begins after approval of artwork and payment. " +
                          "Please review all details carefully before placing your order. Thank you for your business!";
            const splitTerms = doc.splitTextToSize(terms, pageWidth - (2 * margin)); // Use full width minus margins
            doc.text(splitTerms, margin, yPos);
            yPos += (splitTerms.length * 3.5); // Adjust Y based on number of lines

            // --- Product Images Page ---
            doc.addPage();
            addFooter(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages()); // Add footer to new page
            // Start images slightly lower
            await addProductImages(doc, activeCartItems, margin + 10); // Pass margin + space

            // --- Save PDF ---
            const filename = `NWCA_Quote_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            console.log(`[PDF-GEN:SUCCESS] Quote PDF "${filename}" generated.`);
            alert(`Quote PDF "${filename}" has been generated.`);

        } catch (error) {
            console.error("[PDF-GEN:ERROR] Failed to generate Quote PDF:", error);
            alert(`Error generating Quote PDF: ${error.message}`);
        } finally {
            if (generateButton) {
                generateButton.disabled = false;
                generateButton.textContent = 'Download Quote PDF';
            }
        }
    }

    // Expose the generation function globally
    window.NWCAOrderFormPDF = {
        generate: generateQuotePDF
    };

})();