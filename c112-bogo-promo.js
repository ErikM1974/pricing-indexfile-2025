document.addEventListener('DOMContentLoaded', () => {
    // REMOVE const BASE_PRICE = 12.00;
    const MIN_ORDER_QUANTITY = 24;
    const PRODUCT_STYLE = 'C112';
    const DEFAULT_PRODUCT_TITLE = 'Port Authority® Pro Camouflage Series Cap'; // Fallback title

    const C112_8000_STITCH_PRICING_TIERS = [
        { minQty: 24, maxQty: 47, price: 17.00 },
        { minQty: 48, maxQty: 71, price: 16.00 },
        { minQty: 72, maxQty: Infinity, price: 15.50 } // Updated price for 72+
    ];
    const MILTON_TAX_RATE = 0.101; // 10.1%

    let fetchedProductColors = []; // Will be populated by API
    let selectedOrderItems = []; // Array of { color: object, quantity: number }

    const genericC112GalleryImages = [
        { src: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/c112%20front.png?ver=1', alt: 'C112 Front View', type: 'generic' },
        { src: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/C112%20Side.png?ver=1', alt: 'C112 Side View', type: 'generic' },
        { src: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/c112%20back.png?ver=1', alt: 'C112 Back View', type: 'generic' },
        { src: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/IMG_4310%20-%20Edited.png?ver=1', alt: 'C112 Collage', type: 'generic' },
        { src: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/IMG_4487%20-%20Edited.png?ver=1', alt: 'C112 Lifestyle', type: 'generic' }
    ];

    // DOM Elements
    const productTitleEl = document.getElementById('product-title-context');
    const productStyleEl = document.getElementById('product-style-context');
    const mainProductImageEl = document.getElementById('product-image-context');
    const basePriceDisplayEl = document.getElementById('basePriceDisplay'); // In static product info
    // Corrected selector for the description paragraph, as it's now the first/only p in .static-product-info
    const staticProductInfoDescriptionEl = document.querySelector('.static-product-info p:first-of-type');
    
    const colorSwatchesContainerEl = document.getElementById('bogoColorSwatchesContainer');
    const selectedItemsContainerEl = document.getElementById('bogoSelectedItemsContainer');
    const thumbnailGalleryContainerEl = document.getElementById('thumbnailGalleryContainer');
    
    // Updated DOM element references for the new totals structure
    const bogoBreakdownDisplayEl = document.getElementById('bogoBreakdownDisplay');
    const bogoGrossSubtotalEl = document.getElementById('bogoGrossSubtotal'); // Was subtotalPriceEl
    const bogoDiscountEl = document.getElementById('bogoBogoDiscount'); // Stays the same
    const bogoNetSubtotalEl = document.getElementById('bogoNetSubtotal');   // Was totalPriceEl
    const bogoTaxAmountEl = document.getElementById('bogoTaxAmount');
    const bogoGrandTotalEl = document.getElementById('bogoGrandTotal');
    
    const minOrderNoticeEl = document.getElementById('bogoMinOrderNotice');
    const generatePdfButtonEl = document.getElementById('bogoGeneratePdfButton');
    const emailInstructionsEl = document.getElementById('bogoEmailInstructions');
    const priceTiersDisplayEl = document.getElementById('priceTiersDisplay');

    function init() {
        // Set product details
        if (productTitleEl) productTitleEl.innerHTML = DEFAULT_PRODUCT_TITLE; // Use innerHTML if title has <sup> etc.
        if (productStyleEl) productStyleEl.textContent = PRODUCT_STYLE;
        // Base price display is now dynamic, will be set in updateOrderSummaryAndUI
        renderPriceTiers(); // Display the static price tiers
        fetchAndRenderColors(); // This will also attempt to update title and description from API
        updateOrderSummaryAndUI(); // Initial call, will also highlight active tier
        if (generatePdfButtonEl) {
            generatePdfButtonEl.addEventListener('click', handleGeneratePdf);
        }
    }

    async function fetchAndRenderColors() {
        // Use the more comprehensive product-colors API endpoint
        const apiUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/product-colors?styleNumber=${PRODUCT_STYLE}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const productData = await response.json(); // Expects an object like { productTitle, PRODUCT_DESCRIPTION, colors: [...] }

            if (!productData || !productData.colors || productData.colors.length === 0) {
                throw new Error('No product data or colors available from API.');
            }

            // Update product title and description from API if available
            if (productTitleEl && productData.productTitle) {
                productTitleEl.innerHTML = productData.productTitle; // API title overrides default
            }
            // Comment out the dynamic setting of the product description to keep HTML version static
            // if (staticProductInfoDescriptionEl && productData.PRODUCT_DESCRIPTION) {
            //     staticProductInfoDescriptionEl.textContent = productData.PRODUCT_DESCRIPTION;
            // } else if (staticProductInfoDescriptionEl) {
            //     staticProductInfoDescriptionEl.textContent = "Detailed description not available for this product.";
            // }

            fetchedProductColors = productData.colors.map(apiColor => ({
                name: apiColor.COLOR_NAME,
                code: apiColor.CATALOG_COLOR || apiColor.COLOR_NAME.replace(/\s+/g, '-').toUpperCase(),
                img: apiColor.COLOR_SQUARE_IMAGE, // For swatch background
                // Prioritize main image URLs, fallback to swatch image
                productImg: apiColor.MAIN_IMAGE_URL || apiColor.FRONT_MODEL || apiColor.FRONT_FLAT || apiColor.COLOR_SQUARE_IMAGE,
                // Store other image views if needed later for thumbnails, though not used in current BOGO page
                frontModel: apiColor.FRONT_MODEL,
                frontFlat: apiColor.FRONT_FLAT,
                backModel: apiColor.BACK_MODEL,
                backFlat: apiColor.BACK_FLAT,
                sideModel: apiColor.SIDE_MODEL,
                sideFlat: apiColor.SIDE_FLAT
            }));

            const initialMainImageUrl = 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/IMG_4310%20-%20Edited.png?ver=1';
            const initialMainImageAlt = 'C112 Collage';

            if (mainProductImageEl) {
                mainProductImageEl.src = initialMainImageUrl;
                mainProductImageEl.alt = initialMainImageAlt;
            }
            
            renderColorSwatches(fetchedProductColors);
            
            // Render thumbnails. If fetchedProductColors[0] exists, pass it so color-specific thumbs can be prioritized if needed.
            // Otherwise, renderThumbnails will still show generic ones.
            // The active thumbnail logic in renderThumbnails will pick up the initialMainImageUrl.
            if (fetchedProductColors.length > 0) {
                renderThumbnails(fetchedProductColors[0]);
            } else {
                // If no colors fetched, still try to render generic thumbnails if any
                renderThumbnails(null); // Pass null or an empty object to indicate no specific color selected yet
            }

        } catch (error) {
            console.error("Could not fetch or process product data:", error);
            if (colorSwatchesContainerEl) {
                colorSwatchesContainerEl.innerHTML = '<p style="color:red;">Could not load color swatches. Please try again later.</p>';
            }
        }
    }

    function renderColorSwatches(colorsToRender) {
        if (!colorSwatchesContainerEl) return;
        colorSwatchesContainerEl.innerHTML = ''; // Clear existing
        
        if (!colorsToRender || colorsToRender.length === 0) {
            colorSwatchesContainerEl.innerHTML = '<p>No colors available for this product.</p>';
            return;
        }

        colorsToRender.forEach(color => {
            const swatchWrapper = document.createElement('div');
            swatchWrapper.className = 'swatch-wrapper';
            swatchWrapper.dataset.colorCode = color.code;
            swatchWrapper.title = color.name;

            const colorSwatchDiv = document.createElement('div');
            colorSwatchDiv.className = 'color-swatch';
            colorSwatchDiv.style.backgroundImage = `url('${color.img}')`;
            
            const colorNameSpan = document.createElement('span');
            colorNameSpan.className = 'color-name';
            colorNameSpan.textContent = color.name;

            swatchWrapper.appendChild(colorSwatchDiv);
            swatchWrapper.appendChild(colorNameSpan);

            swatchWrapper.addEventListener('click', () => handleColorSwatchClick(color, colorSwatchDiv)); // Pass colorSwatchDiv for active class
            colorSwatchesContainerEl.appendChild(swatchWrapper);
        });
    }

    function handleColorSwatchClick(colorData, swatchDivElement) {
        if (mainProductImageEl) {
            mainProductImageEl.src = colorData.productImg;
            mainProductImageEl.alt = colorData.name;
        }
        renderThumbnails(colorData); // Update thumbnails for the selected color

        const existingItem = selectedOrderItems.find(item => item.color.code === colorData.code);
        if (!existingItem) {
            selectedOrderItems.push({ color: colorData, quantity: 1 });
            renderSelectedOrderItems();
        } else {
            const qtyInput = selectedItemsContainerEl.querySelector(`.item-entry[data-color-code="${colorData.code}"] input[type="number"]`);
            if (qtyInput) qtyInput.focus();
        }
        
        updateOrderSummaryAndUI();

        // Update active state for swatches on the .color-swatch div
        document.querySelectorAll('#bogoColorSwatchesContainer .color-swatch').forEach(sw => sw.classList.remove('active'));
        if (swatchDivElement) swatchDivElement.classList.add('active');
    }

    function renderSelectedOrderItems() {
        if (!selectedItemsContainerEl) return;
        selectedItemsContainerEl.innerHTML = ''; // Clear previous items

        if (selectedOrderItems.length === 0) {
            selectedItemsContainerEl.innerHTML = '<p>Click on a color swatch above to add it here. Then, enter quantities.</p>'; // Updated text
            return;
        }

        // No need to calculate prices here, updateOrderSummaryAndUI will handle it after rendering structure
        selectedOrderItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item-entry');
            itemDiv.dataset.colorCode = item.color.code;
            // Add structure for per-item pricing display
            itemDiv.innerHTML = `
                <div class="item-info">
                    <img src="${item.color.img}" alt="${item.color.name}" style="width:40px; height:40px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle;">
                    <div>
                        <span>${item.color.name}</span>
                        <div class="item-price-info" style="font-size: 0.8em; color: #555; margin-top: 4px;">
                            Tier Price: <span class="line-item-tier-price">$0.00</span> |
                            BOGO 2nd: <span class="line-item-bogo-price">$0.00</span>
                        </div>
                    </div>
                </div>
                <div>
                    Qty: <input type="number" value="${item.quantity}" min="1" data-color-code="${item.color.code}">
                    <button class="remove-item-btn" data-color-code="${item.color.code}">&times; Remove</button>
                </div>
            `;
            selectedItemsContainerEl.appendChild(itemDiv);
        });

        // Add event listeners for new quantity inputs and remove buttons
        selectedItemsContainerEl.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('change', handleQuantityChange);
            input.addEventListener('input', handleQuantityChange); // For immediate feedback
        });
        selectedItemsContainerEl.querySelectorAll('.remove-item-btn').forEach(button => {
            button.addEventListener('click', handleRemoveItem);
        });
    }

    function handleQuantityChange(event) {
        const colorCode = event.target.dataset.colorCode;
        let newQuantity = parseInt(event.target.value, 10);

        if (isNaN(newQuantity) || newQuantity < 1) {
            newQuantity = 1; // Reset to 1 if invalid
            event.target.value = newQuantity;
        }

        const item = selectedOrderItems.find(i => i.color.code === colorCode);
        if (item) {
            item.quantity = newQuantity;
        }
        updateOrderSummaryAndUI();
    }

    function handleRemoveItem(event) {
        const colorCode = event.target.dataset.colorCode;
        selectedOrderItems = selectedOrderItems.filter(item => item.color.code !== colorCode);
        renderSelectedOrderItems();
        updateOrderSummaryAndUI();
        
        // Un-highlight swatch
        const swatchWrapper = colorSwatchesContainerEl.querySelector(`.swatch-wrapper[data-color-code="${colorCode}"]`);
        if (swatchWrapper) {
            const colorSwatchDiv = swatchWrapper.querySelector('.color-swatch');
            if (colorSwatchDiv) colorSwatchDiv.classList.remove('active');
        }
    }

    function getCurrentTierPrice(quantity) {
        if (quantity < MIN_ORDER_QUANTITY) return null;

        for (const tier of C112_8000_STITCH_PRICING_TIERS) {
            if (quantity >= tier.minQty && quantity <= tier.maxQty) {
                return tier.price;
            }
        }
        // Should ideally not be reached if tiers cover up to Infinity
        const lastTier = C112_8000_STITCH_PRICING_TIERS[C112_8000_STITCH_PRICING_TIERS.length - 1];
        if (quantity >= lastTier.minQty) return lastTier.price;
        
        return null;
    }

    function updateOrderSummaryAndUI() {
        let totalQuantity = 0;
        selectedOrderItems.forEach(item => {
            totalQuantity += item.quantity;
        });

        const currentTierPrice = getCurrentTierPrice(totalQuantity);
        let grossSubtotal = 0; // Price of all items at current tier price
        let bogoDiscount = 0;
        let netSubtotal = 0;  // Price after BOGO discount
        let taxAmount = 0;
        let grandTotal = 0;
        let breakdownHtml = '';

        if (currentTierPrice !== null && totalQuantity >= MIN_ORDER_QUANTITY) {
            const numberOfPairs = Math.floor(totalQuantity / 2);
            const singleItems = totalQuantity % 2;
            
            const numberOfFullPriceItems = numberOfPairs + singleItems;
            const numberOfDiscountedItems = numberOfPairs;
            const discountedItemPrice = currentTierPrice * 0.75;

            grossSubtotal = totalQuantity * currentTierPrice;
            bogoDiscount = numberOfDiscountedItems * (currentTierPrice * 0.25); // Total discount amount
            netSubtotal = grossSubtotal - bogoDiscount;
            
            taxAmount = netSubtotal * MILTON_TAX_RATE;
            grandTotal = netSubtotal + taxAmount;

            // Build breakdown HTML
            if (bogoBreakdownDisplayEl) {
                breakdownHtml = `<p>${numberOfFullPriceItems} Cap(s) @ $${currentTierPrice.toFixed(2)} each</p>`;
                if (numberOfDiscountedItems > 0) {
                    breakdownHtml += `<p>${numberOfDiscountedItems} Cap(s) @ $${discountedItemPrice.toFixed(2)} each (25% off)</p>`;
                }
                bogoBreakdownDisplayEl.innerHTML = breakdownHtml;
            }
        } else {
            // Below min order, or no tier price
            const referencePrice = C112_8000_STITCH_PRICING_TIERS[0]?.price || 0;
            grossSubtotal = totalQuantity * referencePrice; // This is a reference, no BOGO, no tax yet
            bogoDiscount = 0;
            netSubtotal = grossSubtotal; // No discount applied
            // Tax is typically not applied if the order doesn't meet minimums or is $0, but let's calculate for consistency if netSubtotal > 0
            taxAmount = (netSubtotal > 0 && totalQuantity > 0) ? netSubtotal * MILTON_TAX_RATE : 0;
            grandTotal = netSubtotal + taxAmount;
            
            if (bogoBreakdownDisplayEl) {
                bogoBreakdownDisplayEl.innerHTML = totalQuantity > 0 ? '<p>Pricing applies above minimum quantity.</p>' : '<p>Add items to see BOGO details.</p>';
            }
        }

        // Update DOM elements for totals
        if (bogoGrossSubtotalEl) bogoGrossSubtotalEl.textContent = `$${grossSubtotal.toFixed(2)}`;
        if (bogoDiscountEl) bogoDiscountEl.textContent = `-$${bogoDiscount.toFixed(2)}`;
        if (bogoNetSubtotalEl) bogoNetSubtotalEl.textContent = `$${netSubtotal.toFixed(2)}`;
        if (bogoTaxAmountEl) bogoTaxAmountEl.textContent = `$${taxAmount.toFixed(2)}`;
        if (bogoGrandTotalEl) bogoGrandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
        
        if (basePriceDisplayEl) {
            if (currentTierPrice && totalQuantity >= MIN_ORDER_QUANTITY) {
                basePriceDisplayEl.innerHTML = `<strong>Current Tier Price: $${currentTierPrice.toFixed(2)}/item.</strong> BOGO: 2nd item 25% off this price.`;
            } else if (totalQuantity > 0 && totalQuantity < MIN_ORDER_QUANTITY) {
                 basePriceDisplayEl.innerHTML = `Add ${MIN_ORDER_QUANTITY - totalQuantity} more item(s) to qualify for BOGO deal & tiered pricing.`;
            } else { // No items or not enough for a tier
                 basePriceDisplayEl.innerHTML = `Pricing is tiered. Min ${MIN_ORDER_QUANTITY} items for BOGO deal.`;
            }
        }

        // Highlight active price tier
        if (priceTiersDisplayEl) {
            const tierItems = priceTiersDisplayEl.querySelectorAll('.price-tier-item');
            tierItems.forEach(item => {
                item.classList.remove('active-tier');
                const minQty = parseInt(item.dataset.minQty, 10);
                const maxQtyStr = item.dataset.maxQty;
                const maxQty = maxQtyStr === 'Infinity' ? Infinity : parseInt(maxQtyStr, 10);

                if (totalQuantity >= minQty && totalQuantity <= maxQty) {
                    item.classList.add('active-tier');
                }
            });
        }

        // Update individual line item prices
        selectedItemsContainerEl.querySelectorAll('.item-entry').forEach(entryDiv => {
            const tierPriceSpan = entryDiv.querySelector('.line-item-tier-price');
            const bogoPriceSpan = entryDiv.querySelector('.line-item-bogo-price');
            if (tierPriceSpan) {
                tierPriceSpan.textContent = currentTierPrice ? `$${currentTierPrice.toFixed(2)}` : 'N/A';
            }
            if (bogoPriceSpan) {
                const bogoItemPrice = currentTierPrice ? (currentTierPrice * 0.75).toFixed(2) : 'N/A';
                bogoPriceSpan.textContent = currentTierPrice ? `$${bogoItemPrice}` : 'N/A';
            }
        });

        if (minOrderNoticeEl && generatePdfButtonEl) {
            if (totalQuantity >= MIN_ORDER_QUANTITY && currentTierPrice !== null) {
                minOrderNoticeEl.textContent = 'Minimum order quantity met for BOGO deal!';
                minOrderNoticeEl.classList.add('met');
                generatePdfButtonEl.disabled = false;
            } else {
                minOrderNoticeEl.textContent = `Minimum ${MIN_ORDER_QUANTITY} caps required for BOGO deal. You have ${totalQuantity}.`;
                minOrderNoticeEl.classList.remove('met');
                generatePdfButtonEl.disabled = true;
            }
        }
        if (emailInstructionsEl) emailInstructionsEl.style.display = 'none';
    }

    function handleGeneratePdf() {
        if (typeof jsPDF === 'undefined') {
            alert('Error: PDF library not loaded. Please ensure you are connected to the internet.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let totalQuantityForPdf = 0;
        selectedOrderItems.forEach(item => { totalQuantityForPdf += item.quantity; });
        const currentTierPriceForPdf = getCurrentTierPrice(totalQuantityForPdf);
        const pageProductTitle = productTitleEl ? productTitleEl.innerText : DEFAULT_PRODUCT_TITLE;

        doc.setFontSize(18);
        doc.text('C112 Cap - BOGO Deal Quote', 14, 22);
        doc.setFontSize(11);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
        doc.text(`Product: ${pageProductTitle} (Style: ${PRODUCT_STYLE})`, 14, 37);
        
        let yPos = 44;
        if (currentTierPriceForPdf) {
            doc.text(`Price Tier Applied (per item before BOGO): $${currentTierPriceForPdf.toFixed(2)}`, 14, yPos);
            yPos += 7;
        }
        
        doc.setFontSize(12);
        doc.text('Order Details:', 14, yPos + 7);
        yPos += 14;
        
        selectedOrderItems.forEach((item) => {
            doc.text(`${item.quantity} x ${item.color.name}`, 14, yPos);
            if (currentTierPriceForPdf) {
                 doc.text(`(Base Tier Price: $${currentTierPriceForPdf.toFixed(2)})`, 100, yPos);
            }
            yPos += 7;
        });

        // Recalculate for PDF to ensure accuracy
        let pdfGrossSubtotal = 0;
        let pdfBogoDiscount = 0;
        let pdfNetSubtotal = 0;
        let pdfTaxAmount = 0;
        let pdfGrandTotal = 0;
        let pdfBreakdownLines = [];

        if (currentTierPriceForPdf && totalQuantityForPdf >= MIN_ORDER_QUANTITY) {
            const numberOfPairs = Math.floor(totalQuantityForPdf / 2);
            const singleItems = totalQuantityForPdf % 2;
            const numberOfFullPriceItems = numberOfPairs + singleItems;
            const numberOfDiscountedItems = numberOfPairs;
            const discountedItemPrice = currentTierPriceForPdf * 0.75;

            pdfGrossSubtotal = totalQuantityForPdf * currentTierPriceForPdf;
            pdfBogoDiscount = numberOfDiscountedItems * (currentTierPriceForPdf * 0.25);
            pdfNetSubtotal = pdfGrossSubtotal - pdfBogoDiscount;
            pdfTaxAmount = pdfNetSubtotal * MILTON_TAX_RATE;
            pdfGrandTotal = pdfNetSubtotal + pdfTaxAmount;

            pdfBreakdownLines.push(`${numberOfFullPriceItems} Cap(s) @ $${currentTierPriceForPdf.toFixed(2)} each`);
            if (numberOfDiscountedItems > 0) {
                pdfBreakdownLines.push(`${numberOfDiscountedItems} Cap(s) @ $${discountedItemPrice.toFixed(2)} each (25% off)`);
            }
        } else {
            const referencePrice = C112_8000_STITCH_PRICING_TIERS[0]?.price || 0;
            pdfGrossSubtotal = totalQuantityForPdf * referencePrice;
            pdfNetSubtotal = pdfGrossSubtotal;
            pdfTaxAmount = (pdfNetSubtotal > 0 && totalQuantityForPdf > 0) ? pdfNetSubtotal * MILTON_TAX_RATE : 0;
            pdfGrandTotal = pdfNetSubtotal + pdfTaxAmount;
        }
        
        yPos += 7; // Space before totals
        doc.setFontSize(10);
        if (pdfBreakdownLines.length > 0) {
            doc.text('BOGO Breakdown:', 14, yPos);
            pdfBreakdownLines.forEach(line => {
                yPos += 5;
                doc.text(line, 18, yPos);
            });
            yPos += 7; // Extra space after breakdown
        }
        
        doc.setFontSize(11);
        doc.text(`Subtotal (Pre-Discount):`, 120, yPos);
        doc.text(`$${pdfGrossSubtotal.toFixed(2)}`, 180, yPos, { align: 'right' });
        yPos += 7;
        doc.text(`BOGO Discount:`, 120, yPos);
        doc.text(`-$${pdfBogoDiscount.toFixed(2)}`, 180, yPos, { align: 'right' });
        yPos += 7;
        doc.text(`Subtotal (Post-Discount):`, 120, yPos);
        doc.text(`$${pdfNetSubtotal.toFixed(2)}`, 180, yPos, { align: 'right' });
        yPos += 7;
        doc.text(`Milton Sales Tax (10.1%):`, 120, yPos);
        doc.text(`$${pdfTaxAmount.toFixed(2)}`, 180, yPos, { align: 'right' });
        yPos += 7;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Grand Total:`, 120, yPos);
        doc.text(`$${pdfGrandTotal.toFixed(2)}`, 180, yPos, { align: 'right' });
        doc.setFont(undefined, 'normal');
        
        yPos += 15;
        doc.setFontSize(10);
        doc.text('Minimum order 24 caps. Price includes 8000-stitch embroidery.', 14, yPos);
        yPos += 5;
        doc.text('Please email this quote to sales@nwcustomapparel.com to finalize your order.', 14, yPos);

        doc.save('NWCA_C112_BOGO_Quote.pdf');
        if (emailInstructionsEl) emailInstructionsEl.style.display = 'block';
    }

    function renderPriceTiers() {
        if (!priceTiersDisplayEl) return;
        priceTiersDisplayEl.innerHTML = ''; // Clear previous (if any)

        const heading = document.createElement('h4');
        heading.textContent = 'Quantity Pricing (per item):';
        priceTiersDisplayEl.appendChild(heading);

        C112_8000_STITCH_PRICING_TIERS.forEach(tier => {
            const tierDiv = document.createElement('div');
            tierDiv.classList.add('price-tier-item');
            tierDiv.dataset.minQty = tier.minQty;
            tierDiv.dataset.maxQty = tier.maxQty;
            
            let rangeText = `${tier.minQty}`;
            if (tier.maxQty === Infinity) {
                rangeText += '+';
            } else {
                rangeText += `-${tier.maxQty}`;
            }
            rangeText += ` units: $${tier.price.toFixed(2)} each`;
            tierDiv.textContent = rangeText;
            priceTiersDisplayEl.appendChild(tierDiv);
        });
    }

    function renderThumbnails(selectedColorData) {
        if (!thumbnailGalleryContainerEl) return;
        thumbnailGalleryContainerEl.innerHTML = ''; // Clear previous thumbnails

        let thumbnailSources = [];

        // Add views from the selected color data (API)
        // These are properties we mapped like: productImg, frontModel, frontFlat, backModel, backFlat, sideModel, sideFlat
        const colorSpecificViewKeys = ['productImg', 'frontModel', 'frontFlat', 'backModel', 'backFlat', 'sideModel', 'sideFlat'];
        colorSpecificViewKeys.forEach(key => {
            if (selectedColorData[key]) {
                thumbnailSources.push({
                    src: selectedColorData[key],
                    alt: `${selectedColorData.name} - ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`, // e.g. "Front Model"
                    type: 'color'
                });
            }
        });

        // Add generic C112 images provided by user
        genericC112GalleryImages.forEach(view => {
            thumbnailSources.push(view); // Assumes genericC112GalleryImages items have {src, alt, type}
        });
        
        // De-duplicate based on src to avoid showing the same image multiple times
        const uniqueThumbnailSources = Array.from(new Map(thumbnailSources.map(item => [item.src, item])).values());

        uniqueThumbnailSources.forEach(imgData => {
            if (!imgData.src) return; // Skip if src is somehow null or empty

            const thumbImg = document.createElement('img');
            thumbImg.src = imgData.src;
            thumbImg.alt = imgData.alt;
            thumbImg.classList.add('gallery-thumbnail');
            thumbImg.addEventListener('click', () => {
                if (mainProductImageEl) {
                    mainProductImageEl.src = imgData.src;
                    mainProductImageEl.alt = imgData.alt;
                }
                // Update active state on thumbnails
                thumbnailGalleryContainerEl.querySelectorAll('.gallery-thumbnail').forEach(t => t.classList.remove('active-thumbnail'));
                thumbImg.classList.add('active-thumbnail');
            });
            thumbnailGalleryContainerEl.appendChild(thumbImg);
        });

        // Set initial active thumbnail based on the current main image
        if (mainProductImageEl && mainProductImageEl.src) {
            const currentMainImageSrc = mainProductImageEl.src;
            const activeThumb = Array.from(thumbnailGalleryContainerEl.querySelectorAll('.gallery-thumbnail')).find(t => t.src === currentMainImageSrc);
            if (activeThumb) {
                activeThumb.classList.add('active-thumbnail');
            } else if (thumbnailGalleryContainerEl.firstChild && thumbnailGalleryContainerEl.firstChild.nodeName === 'IMG') {
                // Fallback: activate the first thumbnail if no direct match
                (thumbnailGalleryContainerEl.firstChild).classList.add('active-thumbnail');
            }
        }
    }

    init();
});