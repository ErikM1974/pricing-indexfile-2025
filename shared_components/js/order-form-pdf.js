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

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
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
                reject(new Error("Failed to load image via proxy from URL: " + url));
            };
            const encodedUrl = encodeURIComponent(url);
            const proxyUrl = `/api/image-proxy?url=${encodedUrl}`;
            console.log(`[PDF-GEN:IMG] Loading image via proxy: ${proxyUrl}`);
            img.src = proxyUrl;
        });
    }

    async function addHeader(doc, options = {}) {
            const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
            const margin = 15;
            
            try {
                const logoData = await loadImage(COMPANY_LOGO_URL);
                const logoHeight = 20; 
                const logoWidth = 48; 
                doc.addImage(logoData, 'PNG', margin, margin, logoWidth, logoHeight);
            } catch (error) {
                console.error("[PDF-GEN:ERROR] Failed to load logo:", error);
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(COMPANY_NAME, margin, margin + 10);
            }
    
            doc.setFontSize(18); 
            doc.setFont(undefined, 'bold');
            doc.text("Quote", pageWidth / 2, margin + 12, { align: 'center' });
    
            doc.setFontSize(9); 
            doc.setFont(undefined, 'normal');
            const quoteNumber = `Quote #: Q-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const generatedDate = `Date: ${new Date().toLocaleDateString()}`;
            const validUntil = `Valid Until: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}`;
            
            doc.text(quoteNumber, pageWidth - margin, margin + 5, { align: 'right' });
            doc.text(generatedDate, pageWidth - margin, margin + 10, { align: 'right' });
            doc.text(validUntil, pageWidth - margin, margin + 15, { align: 'right' });
            
            doc.setLineWidth(0.1); 
            doc.line(margin, margin + 30, pageWidth - margin, margin + 30);
    
            return margin + 36; 
    }

    function addFooter(doc, pageNumber, totalPages) {
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const margin = 15;
        const footerY = pageHeight - margin;

        doc.setLineWidth(0.1); 
        doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

        doc.setFontSize(7); 
        doc.setFont(undefined, 'normal');
        const fullCompanyInfo = `${COMPANY_ADDRESS} | Ph: ${COMPANY_PHONE} | Em: ${COMPANY_EMAIL} | Web: ${COMPANY_WEBSITE}`;
        doc.text(fullCompanyInfo, margin, footerY - 4);

        doc.setFontSize(6); 
        doc.text("Prices subject to change. Shipping and taxes not included.", margin, footerY);

        doc.setFontSize(7);
        const pageNumText = `Page ${pageNumber} of ${totalPages}`;
        doc.text(pageNumText, pageWidth - margin, footerY, { align: 'right' });
    }

    function formatCurrency(amount) {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g,"")) : Number(amount);
        if (isNaN(numericAmount)) {
            return '$?.??';
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericAmount);
    }
    
    function sortSizes(sizes) {
        const sizeOrder = {
            'S': 10, 'M': 20, 'L': 30, 'XL': 40,
            '2XL': 50, '3XL': 60, '4XL': 70, '5XL': 80, 'OSFA': 90 // Added OSFA
        };
        return [...sizes].sort((a, b) => {
            const sizeA = a.size || a.Size;
            const sizeB = b.size || b.Size;
            return (sizeOrder[sizeA] || 100) - (sizeOrder[sizeB] || 100);
        });
    }

    async function addProductImages(doc, activeCartItems, startY) {
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = startY;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Product Details", margin, yPos);
        yPos += 12; 

        const imagesPerRow = 1; 
        const imageDisplayWidth = 60; 
        const imageDisplayHeight = 60;
        const textBlockPadding = 3; 
        const spaceBetweenImageAndText = 8; 
        
        const contentAreaWidth = pageWidth - (2 * margin);
        const productColumnWidth = contentAreaWidth; 
        
        const textBlockWidth = productColumnWidth - imageDisplayWidth - spaceBetweenImageAndText - (2 * textBlockPadding);
        
        const verticalSpacing = 18; 
        const textLineHeight = 5; 
        const sizePriceColumns = 2; 
        const sizePriceColumnThreshold = 4; 

        const uniqueProducts = [];
        const uniqueKeys = new Set();
        activeCartItems.forEach(cartItem => {
            const originalItem = activeCartItems.find(aci => aci.StyleNumber === cartItem.StyleNumber && aci.Color === cartItem.Color);
            if (!originalItem || !originalItem.StyleNumber || !originalItem.Color || !originalItem.sizes || !Array.isArray(originalItem.sizes)) return;
            const key = `${originalItem.StyleNumber}-${originalItem.Color}`;
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                const allSizesForProduct = originalItem.sizes
                    .filter(s => typeof s.UnitPrice !== 'undefined')
                    .map(s => ({ 
                        size: s.Size, 
                        unitPrice: s.UnitPrice,
                        quantity: (s.Quantity || s.quantity || 0) // Include quantity
                    }));
                uniqueProducts.push({
                    StyleNumber: originalItem.StyleNumber,
                    Color: originalItem.Color,
                    imageUrl: originalItem.imageUrl,
                    allSizes: sortSizes(allSizesForProduct)
                });
            }
        });

        let currentX = margin; 
        let currentY = yPos;

        for (let i = 0; i < uniqueProducts.length; i++) {
            const product = uniqueProducts[i];
            
            let currentProductTextHeight = textLineHeight * 2; 
            currentProductTextHeight += textLineHeight * 0.5; 
            if (product.allSizes && product.allSizes.length > 0) {
                if (product.allSizes.length > sizePriceColumnThreshold) { 
                    currentProductTextHeight += Math.ceil(product.allSizes.length / sizePriceColumns) * textLineHeight;
                } else { 
                    currentProductTextHeight += product.allSizes.length * textLineHeight;
                }
            } else {
                currentProductTextHeight += textLineHeight; 
            }
            const currentProductEntryHeight = Math.max(imageDisplayHeight, currentProductTextHeight) + (textBlockPadding * 2);

            if (i > 0) { 
                 currentY += verticalSpacing;
            }
            
            if (currentY + currentProductEntryHeight > pageHeight - margin - 20) { 
                doc.addPage();
                addFooter(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages());
                currentY = margin + 10;
            }

            const productBoxStartX = currentX;
            const productBoxStartY = currentY;

            if (product.imageUrl) {
                try {
                    const imageData = await loadImage(product.imageUrl);
                    const imgProps = doc.getImageProperties(imageData);
                    let actualDrawWidth = imageDisplayWidth;
                    let actualDrawHeight = imageDisplayHeight;
                    const ratio = imgProps.width / imgProps.height;
                    if (imgProps.height > actualDrawHeight) { actualDrawHeight = imageDisplayHeight; actualDrawWidth = actualDrawHeight * ratio; }
                    if (actualDrawWidth > imageDisplayWidth) { actualDrawWidth = imageDisplayWidth; actualDrawHeight = actualDrawWidth / ratio; }
                    const imageXOffset = (imageDisplayWidth - actualDrawWidth) / 2;
                    const imageYOffset = (imageDisplayHeight - actualDrawHeight) / 2; 
                    doc.addImage(imageData, 'JPEG', productBoxStartX + imageXOffset, productBoxStartY + imageYOffset, actualDrawWidth, actualDrawHeight);
                } catch (error) {
                    console.warn(`[PDF-GEN:WARN] Failed to load image for ${product.StyleNumber}:`, error);
                    doc.setDrawColor(200); doc.setFillColor(240);
                    doc.rect(productBoxStartX, productBoxStartY, imageDisplayWidth, imageDisplayHeight, 'FD');
                    doc.setFontSize(8); doc.setTextColor(100);
                    doc.text("Image N/A", productBoxStartX + imageDisplayWidth/2, productBoxStartY + imageDisplayHeight/2, { align: 'center', baseline: 'middle' });
                    doc.setTextColor(0);
                }
            } else { 
                doc.setDrawColor(200); doc.setFillColor(240);
                doc.rect(productBoxStartX, productBoxStartY, imageDisplayWidth, imageDisplayHeight, 'FD');
                doc.setFontSize(8); doc.setTextColor(100);
                doc.text("No Image", productBoxStartX + imageDisplayWidth/2, productBoxStartY + imageDisplayHeight/2, { align: 'center', baseline: 'middle' });
                doc.setTextColor(0);
            }

            let textInfoX = productBoxStartX + imageDisplayWidth + spaceBetweenImageAndText;
            let textInfoY = productBoxStartY + textBlockPadding;

            doc.setFontSize(9); doc.setFont('helvetica', 'bold');
            doc.text(product.StyleNumber || 'N/A', textInfoX, textInfoY, { maxWidth: textBlockWidth });
            textInfoY += textLineHeight;
            doc.setFontSize(8); doc.setFont('helvetica', 'normal');
            doc.text(product.Color || 'N/A', textInfoX, textInfoY, { maxWidth: textBlockWidth });
            textInfoY += textLineHeight * 1.5; 

            doc.setFontSize(7); doc.setFont('helvetica', 'normal');
            if (product.allSizes && product.allSizes.length > 0) {
                const sizes = product.allSizes;
                const eachColWidth = (textBlockWidth / sizePriceColumns) - ((sizePriceColumns -1) * 2 / sizePriceColumns) ; 

                if (sizes.length > sizePriceColumnThreshold) { 
                    const col1X = textInfoX;
                    const col2X = textInfoX + eachColWidth + 4; 
                    let yCol1 = textInfoY;
                    let yCol2 = textInfoY;
                    const midPoint = Math.ceil(sizes.length / 2);

                    sizes.forEach((sizeInfo, idx) => {
                        const sizePriceText = `${sizeInfo.size} (Qty: ${sizeInfo.quantity}): ${formatCurrency(sizeInfo.unitPrice)}`;
                        if (idx < midPoint) { 
                            if (yCol1 < productBoxStartY + currentProductEntryHeight - textBlockPadding) { 
                                doc.text(sizePriceText, col1X, yCol1, { maxWidth: eachColWidth });
                                yCol1 += textLineHeight;
                            }
                        } else { 
                             if (yCol2 < productBoxStartY + currentProductEntryHeight - textBlockPadding) { 
                                doc.text(sizePriceText, col2X, yCol2, { maxWidth: eachColWidth });
                                yCol2 += textLineHeight;
                            }
                        }
                    });
                    textInfoY = Math.max(yCol1, yCol2); 
                } else { 
                    sizes.forEach(sizeInfo => {
                         if (textInfoY < productBoxStartY + currentProductEntryHeight - textBlockPadding) { 
                            const sizePriceText = `${sizeInfo.size} (Qty: ${sizeInfo.quantity}): ${formatCurrency(sizeInfo.unitPrice)}`;
                            doc.text(sizePriceText, textInfoX, textInfoY, { maxWidth: textBlockWidth }); // Use full textBlockWidth for single column
                            textInfoY += textLineHeight;
                        }
                    });
                }
            } else {
                doc.text("Pricing N/A", textInfoX, textInfoY, { maxWidth: textBlockWidth });
                textInfoY += textLineHeight;
            }
            currentY = productBoxStartY + currentProductEntryHeight; 
        }
        
        return currentY + verticalSpacing; 
    }

    function addEmbellishmentInfo(doc, items, startY) {
        console.log("[PDF-GEN:INFO] Using inline embellishment info instead of separate section");
        return startY;
    }

    async function generateQuotePDF() {
        console.log("[PDF-GEN:START] Starting Quote PDF generation...");
        const generateButton = document.getElementById('download-quote-pdf-btn');
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.textContent = 'Generating...';
        }

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
            if (!window.NWCACart || typeof window.NWCACart.getCartItems !== 'function') {
                throw new Error("Cart system (NWCACart) or getCartItems method not available.");
            }
            const activeCartItems = window.NWCACart.getCartItems('Active');
            if (!activeCartItems || !Array.isArray(activeCartItems) || activeCartItems.length === 0) {
                alert("Your cart is empty or contains no active items. Add items before generating a quote.");
                throw new Error("Cart is empty or contains no active items.");
            }

            const doc = new jsPDF();
            console.log("[PDF-GEN:INFO] Creating multi-page professional quote layout");
            let yPos = await addHeader(doc, { title: "Quote" }); 

            const tableHeaders = ["Style Number", "Color", "Embellishment", "Size", "Quantity", "Unit Price", "Line Total"];
            const tableBody = [];
            let subtotal = 0;
            let totalLtmFee = 0; 

            const itemsByEmbellishment = activeCartItems.reduce((acc, item) => {
                const type = item.ImprintType || 'Unknown'; 
                if (!acc[type]) acc[type] = [];
                acc[type].push(item); 
                return acc;
            }, {});

            const ltmFeesApplied = {};
            for (const type in itemsByEmbellishment) {
                const itemsOfType = itemsByEmbellishment[type];
                let quantityOfType = 0;
                itemsOfType.forEach(item => {
                    if (item.sizes && Array.isArray(item.sizes)) {
                        item.sizes.forEach(size => {
                            quantityOfType += parseInt(size.Quantity || size.quantity || 0);
                        });
                    }
                });
                if (quantityOfType > 0 && quantityOfType < 24) {
                    ltmFeesApplied[type] = 50.00; 
                    totalLtmFee += 50.00;
                }
            }

            activeCartItems.forEach(item => {
                if (!item || !item.StyleNumber || !item.sizes || !Array.isArray(item.sizes) || item.sizes.length === 0) {
                    console.warn("[PDF-GEN:SKIP] Skipping invalid item:", item);
                    return;
                }
                item.sizes.forEach(sizeDetail => {
                    if (!sizeDetail || typeof (sizeDetail.Quantity || sizeDetail.quantity) === 'undefined') return;
                    const qty = parseInt(sizeDetail.Quantity || sizeDetail.quantity) || 0;
                    if (qty === 0) return;
                    const unitPrice = parseFloat(sizeDetail.UnitPrice) || 0; 
                    const lineTotal = qty * unitPrice;
                    subtotal += lineTotal; 
                    tableBody.push([
                        item.StyleNumber || 'N/A',   
                        item.Color || 'N/A',          
                        item.ImprintType || 'N/A',    
                        sizeDetail.Size || 'N/A',     
                        qty,                          
                        formatCurrency(unitPrice),    
                        formatCurrency(lineTotal)     
                    ]);
                });
            });

            const groupedTableBody = [];
            const groupedItems = {};
            tableBody.forEach(row => {
                const styleColorEmb = `${row[0]}-${row[1]}-${row[2]}`;
                if (!groupedItems[styleColorEmb]) {
                    groupedItems[styleColorEmb] = { styleNumber: row[0], color: row[1], embellishment: row[2], sizes: [] };
                }
                groupedItems[styleColorEmb].sizes.push({ size: row[3], quantity: row[4], unitPrice: row[5], lineTotal: row[6]});
            });
            
            Object.values(groupedItems).forEach(item => {
                const sortedSizes = sortSizes(item.sizes);
                sortedSizes.forEach((size) => {
                    groupedTableBody.push([ item.styleNumber, item.color, item.embellishment, size.size, size.quantity, size.unitPrice, size.lineTotal ]);
                });
                if (sortedSizes.length > 0) {
                    groupedTableBody.push([ "---", "", "", "", "", "", "" ]);
                }
            });
            if (groupedTableBody.length > 0 && groupedTableBody[groupedTableBody.length-1][0] === "---") {
                groupedTableBody.pop();
            }

            if (groupedTableBody.length > 0) {
                doc.autoTable({
                    head: [tableHeaders],
                    body: groupedTableBody,
                    startY: yPos,
                    margin: { left: 15, right: 15 }, 
                    theme: 'striped', 
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
                    styles: { fontSize: 8, font: 'helvetica', cellPadding: 3, valign: 'middle', lineWidth: 0.1, lineColor: [220, 220, 220] },
                    alternateRowStyles: { fillColor: [245, 245, 245] },
                    willDrawCell: function(data) {
                        if (data.row.raw[0] === "---") { doc.setTextColor(255, 255, 255); }
                    },
                    didParseCell: function(data) {
                         if (data.row.raw[0] === "---") {
                             data.cell.text = ''; 
                             data.cell.styles.fillColor = '#ffffff'; 
                             data.cell.styles.lineWidth = 0; 
                         }
                    },
                    columnStyles: {
                        0: { cellWidth: 25, fontStyle: 'bold' }, 1: { cellWidth: 25 }, 2: { cellWidth: 30 }, 
                        3: { cellWidth: 15, halign: 'center' }, 4: { cellWidth: 20, halign: 'right' }, 
                        5: { cellWidth: 30, halign: 'right' }, 6: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } 
                    },
                    didDrawPage: function (data) {
                        addFooter(doc, data.pageNumber, doc.internal.getNumberOfPages());
                    }
                });
                yPos = doc.lastAutoTable.finalY + 10; 
            } else {
                 doc.text("No items with quantity found in the cart.", 15, yPos);
                 yPos += 10;
            }

            const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
            const margin = 15; 
            const summaryStartY = yPos;
            const summaryBlockWidth = 70; 
            const summaryBlockX = pageWidth - margin - summaryBlockWidth; 
            const summaryLineHeight = 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            doc.text("Sub Total:", summaryBlockX, summaryStartY);
            doc.text(formatCurrency(subtotal), summaryBlockX + summaryBlockWidth, summaryStartY, { align: 'right' });
            yPos = summaryStartY + summaryLineHeight;

            if (totalLtmFee > 0) {
                doc.setTextColor(220, 53, 69); 
                doc.text("Less Than Minimum Fee:", summaryBlockX, yPos);
                doc.text(formatCurrency(totalLtmFee), summaryBlockX + summaryBlockWidth, yPos, { align: 'right' });
                doc.setTextColor(0); 
                yPos += summaryLineHeight;
            }

            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.2);
            doc.line(summaryBlockX, yPos, summaryBlockX + summaryBlockWidth, yPos);
            yPos += 3; 

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text("Total:", summaryBlockX, yPos);
            doc.text(formatCurrency(subtotal + totalLtmFee), summaryBlockX + summaryBlockWidth, yPos, { align: 'right' });
            yPos += summaryLineHeight + 2; 

            const embX = margin; 
            let embY = summaryStartY; 

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
                embellishmentTypes[type].count++; 
                if (item.sizes && Array.isArray(item.sizes)) {
                    item.sizes.forEach(size => {
                        embellishmentTypes[type].quantity += parseInt(size.Quantity || size.quantity || 0);
                    });
                }
            });

            for (const type in embellishmentTypes) {
                 doc.text(`${type}: ${embellishmentTypes[type].quantity} pcs`, embX, embY);
                 embY += summaryLineHeight -1; 
            }

            yPos = Math.max(yPos, embY) + 10; 

            const termsStartY = yPos;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text("Terms and Conditions", margin, termsStartY);
            yPos = termsStartY + 5;

            doc.setFontSize(7); 
            doc.setFont('helvetica', 'normal');
            const terms = "This quote is valid for 30 days from the date of issue. Prices are subject to change without notice after the validity period. " +
                          "Shipping, taxes, and additional fees are not included in this quote. Production time begins after approval of artwork and payment. " +
                          "Please review all details carefully before placing your order. Thank you for your business!";
            const splitTerms = doc.splitTextToSize(terms, pageWidth - (2 * margin)); 
            doc.text(splitTerms, margin, yPos);
            yPos += (splitTerms.length * 3.5); 

            doc.addPage();
            addFooter(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages()); 
            await addProductImages(doc, activeCartItems, margin + 10);

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

    window.NWCAOrderFormPDF = {
        generate: generateQuotePDF
    };

})();