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

    // Customer Form Elements
    const customerFormEl = document.getElementById('bogoCustomerForm');
    const customerNameEl = document.getElementById('customerName');
    const customerEmailEl = document.getElementById('customerEmail');
    const customerPhoneEl = document.getElementById('customerPhone');
    const customerCompanyEl = document.getElementById('customerCompany');
    const customerAddress1El = document.getElementById('customerAddress1');
    const customerAddress2El = document.getElementById('customerAddress2');
    const customerCityEl = document.getElementById('customerCity');
    const customerStateEl = document.getElementById('customerState');
    const customerZipCodeEl = document.getElementById('customerZipCode');
    const customerCountryEl = document.getElementById('customerCountry');
    const customerApiFeedbackEl = document.getElementById('customerApiFeedback');

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
        setupAccordion(); // Call to set up the new accordion
    }

    function setupAccordion() {
        const accordionItems = document.querySelectorAll('.ordering-info-section .collapsible-item');
        
        accordionItems.forEach((item, index) => {
            const header = item.querySelector('.collapsible-header');
            const content = item.querySelector('.collapsible-content');

            if (!header) {
                console.error('Collapsible header not found in item:', item);
                return;
            }
            if (!content) {
                console.error('Collapsible content not found in item:', item);
                return;
            }

            // Initialize: Open the first item by default using inline style
            if (index === 0) {
                header.classList.add('active'); // For icon
                content.style.display = 'block'; // Show with inline style
            } else {
                // Ensure other headers are not active and content is hidden with inline style
                header.classList.remove('active'); // For icon
                content.style.display = 'none';  // Hide with inline style
            }

            header.addEventListener('click', () => {
                console.log('Accordion header clicked:', header);
                console.log('Associated content div:', content);
                
                // Toggle 'active' class on the header (for icon rotation via CSS)
                header.classList.toggle('active');
                
                // Toggle display of content using inline styles
                let newDisplayState;
                if (content.style.display === 'block') {
                    content.style.display = 'none';
                    content.classList.remove('active'); // CRITICAL: Remove the active class
                    content.classList.remove('is-expanded'); // CRITICAL: Also remove the is-expanded class from shared CSS
                    newDisplayState = 'none';
                    // Optionally reset any aggressive styles when hiding
                    content.style.height = '';
                    content.style.maxHeight = ''; // Reset max-height explicitly
                    content.style.opacity = '';
                    content.style.visibility = '';
                    content.style.overflow = ''; // Reset overflow explicitly
                } else {
                    content.style.display = 'block';
                    content.classList.add('active'); // CRITICAL: Add the active class
                    content.classList.add('is-expanded'); // CRITICAL: Also add the is-expanded class from shared CSS
                    newDisplayState = 'block';
                    // Aggressively try to make the content div and its children visible
                    content.style.height = 'auto'; // Override fixed height
                    content.style.maxHeight = '2000px !important'; // Override max-height with a large value
                    content.style.opacity = '1';
                    content.style.visibility = 'visible';
                    content.style.overflow = 'visible'; // Ensure overflow is visible
                    content.style.color = 'red'; // Make text red to be VERY obvious
                    content.style.fontSize = '16px'; // Force a visible font size
                    
                    Array.from(content.children).forEach(child => {
                        if (child instanceof HTMLElement) {
                            child.style.display = 'block'; // Ensure children are block
                            child.style.height = 'auto';
                            child.style.opacity = '1';
                            child.style.visibility = 'visible';
                            child.style.color = 'blue'; // Make direct children blue
                            child.style.fontSize = '16px';
                        }
                    });
                    // Log the innerHTML when we try to show it
                    console.log(`innerHTML of content div (should be red/blue if styled):`, content.innerHTML);
                }
                
                console.log('Header active state:', header.classList.contains('active'));
                console.log('Content display style IMMEDIATELY SET TO:', newDisplayState);

                // Check the style again after a short delay to detect interference
                setTimeout(() => {
                    const headerTextForLog = header.textContent.trim().substring(0, 30); // Get first 30 chars of header text
                    console.log(`AFTER 100ms DELAY: For header "${headerTextForLog}...", content display is: ${content.style.display}`);
                    if (newDisplayState === 'block' && content.style.display !== 'block') {
                        console.warn(`WARNING: For header "${headerTextForLog}...", content display was 'block' but is now '${content.style.display}' after 100ms! Interference suspected.`);
                    }
                    if (newDisplayState === 'block') {
                        console.log(`innerHTML of content div AFTER 100ms DELAY:`, content.innerHTML);
                    }
                }, 100);
            });
        });
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

    function displayApiFeedback(message, type) {
        if (!customerApiFeedbackEl) return;
        customerApiFeedbackEl.textContent = message;
        customerApiFeedbackEl.className = `api-feedback ${type}`; // type can be 'success' or 'error'
        customerApiFeedbackEl.style.display = 'block';
    }

    // Helper function to fetch an image and convert to Data URI
    async function getImageDataUri(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok for image ${url}: ${response.statusText}`);
            }
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error(`Error fetching or converting image ${url}:`, error);
            return null; // Return null if fetching/conversion fails
        }
    }

    async function handleGeneratePdf() { // Made async to handle await for API call
        console.log('handleGeneratePdf called. Checking window.jspdf:', window.jspdf);
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            alert('Error: PDF library (jsPDF) not loaded. Please ensure you are connected to the internet and try refreshing the page.');
            console.error("jsPDF library not found on window.jspdf or window.jspdf.jsPDF was not initialized.");
            return;
        }

        let customerDataForPdf = null;
        let proceedWithPdf = true;

        // Check if customer form has been filled (at least required fields)
        const name = customerNameEl.value.trim();
        const email = customerEmailEl.value.trim();
        const phone = customerPhoneEl.value.trim();

        if (name || email || phone) { // User has attempted to fill the form
            // Validate required fields
            if (!name || !email || !phone) {
                displayApiFeedback('Please fill in all required fields: Name, Email, and Phone.', 'error');
                proceedWithPdf = false; // Don't generate PDF if required fields are missing after attempting to fill
                return; // Stop here
            }
            // Basic email validation
            if (!/^\S+@\S+\.\S+$/.test(email)) {
                displayApiFeedback('Please enter a valid email address.', 'error');
                proceedWithPdf = false;
                return; // Stop here
            }

            const customerDataPayload = {
                Name: name,
                Email: email,
                Phone: phone,
                Company: customerCompanyEl.value.trim(),
                Address1: customerAddress1El.value.trim(),
                Address2: customerAddress2El.value.trim(),
                City: customerCityEl.value.trim(),
                State: customerStateEl.value.trim(),
                ZipCode: customerZipCodeEl.value.trim(),
                Country: customerCountryEl.value.trim()
            };
            customerDataForPdf = { ...customerDataPayload }; // Store for PDF regardless of API outcome

            try {
                const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(customerDataPayload)
                });
                
                // Try to parse JSON only if response is likely to have a body
                let resultMessage = `Response status: ${response.status}`;
                if (response.headers.get("content-type")?.includes("application/json")) {
                    const result = await response.json();
                    resultMessage = result.message || `Customer API: ${response.statusText}`;
                }

                if (response.ok) { // Typically 200-299
                    displayApiFeedback(`Customer details saved successfully. ${resultMessage}`, 'success');
                } else {
                    displayApiFeedback(`Error saving customer details: ${resultMessage}. Details will still be on PDF.`, 'error');
                }
            } catch (error) {
                console.error('API submission error:', error);
                displayApiFeedback(`Network error saving customer details: ${error.message}. Details will still be on PDF.`, 'error');
            }
        } else {
            // Form not filled, clear any previous feedback
            if (customerApiFeedbackEl) customerApiFeedbackEl.style.display = 'none';
        }
        
        // PDF Generation Logic (proceeds if form was skipped or after API attempt)
        console.log('Proceeding to PDF generation. window.jspdf.jsPDF is:', window.jspdf.jsPDF);
        const jsPDFConstructor = window.jspdf.jsPDF; // Assign directly

        if (typeof jsPDFConstructor !== 'function') {
            alert('Error: jsPDF constructor is not a function. Library might be corrupted or loaded incorrectly.');
            console.error('window.jspdf.jsPDF is not a function:', jsPDFConstructor);
            return;
        }
        const doc = new jsPDFConstructor();
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14; // Page margin
        let yPos = margin;

        // --- 1. Header: Company Name (Text), Quote Title, Date ---
        doc.setFont(undefined, 'bold');
        doc.setFontSize(16);
        doc.text('Northwest Custom Apparel', margin, yPos + 5); // Adjusted yPos for text
        
        doc.setFontSize(18); // PRICE QUOTE title
        doc.text('PRICE QUOTE', pageWidth - margin, yPos + 7, { align: 'right' });
        yPos += 15; // Initial yPos increment after company name / quote title line

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 7; // Space after date line
        // Removed priming call and swatch pre-loading logic
        yPos += 5; // Space before customer info

        // --- 2. Customer Information (if available) ---
        if (customerDataForPdf) {
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Customer Information:', margin, yPos);
            yPos += 6;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            if (customerDataForPdf.Name) { doc.text(`Name: ${customerDataForPdf.Name}`, margin, yPos); yPos += 5; }
            if (customerDataForPdf.Company) { doc.text(`Company: ${customerDataForPdf.Company}`, margin, yPos); yPos += 5; }
            if (customerDataForPdf.Email) { doc.text(`Email: ${customerDataForPdf.Email}`, margin, yPos); yPos += 5; }
            if (customerDataForPdf.Phone) { doc.text(`Phone: ${customerDataForPdf.Phone}`, margin, yPos); yPos += 5; }
            
            let addressString = '';
            if (customerDataForPdf.Address1) addressString += customerDataForPdf.Address1;
            if (customerDataForPdf.Address2) addressString += (addressString ? `, ${customerDataForPdf.Address2}` : customerDataForPdf.Address2);
            
            let cityStateZip = [];
            if (customerDataForPdf.City) cityStateZip.push(customerDataForPdf.City);
            if (customerDataForPdf.State) cityStateZip.push(customerDataForPdf.State);
            if (customerDataForPdf.ZipCode) cityStateZip.push(customerDataForPdf.ZipCode);
            if (cityStateZip.length > 0) addressString += (addressString ? `, ${cityStateZip.join(', ')}` : cityStateZip.join(', '));
            if (customerDataForPdf.Country) addressString += (addressString ? `, ${customerDataForPdf.Country}` : customerDataForPdf.Country);

            if (addressString) {
                doc.text(`Address: ${addressString}`, margin, yPos); yPos += 5;
            }
            yPos += 7; // Extra space after customer info
        }

        // --- 3. Product & Order Details ---
        // Section "Quote For:" and "Unit Price Applied (before BOGO)" is removed.
        const pageProductTitle = productTitleEl ? productTitleEl.innerText : DEFAULT_PRODUCT_TITLE;
        yPos += 5; // Add some space if customer info was present, or if not, start after header.

        let totalQuantityForPdf = 0;
        selectedOrderItems.forEach(item => { totalQuantityForPdf += item.quantity; });
        const currentTierPriceForPdf = getCurrentTierPrice(totalQuantityForPdf);
        const discountedItemPriceForPdf = currentTierPriceForPdf ? currentTierPriceForPdf * 0.75 : 0;

        // Calculate overall BOGO distribution for the entire order
        let orderTotalFullPriceItems = 0;
        let orderTotalDiscountedItems = 0;
        if (currentTierPriceForPdf && totalQuantityForPdf >= MIN_ORDER_QUANTITY) {
            const numberOfPairs = Math.floor(totalQuantityForPdf / 2);
            const singleItems = totalQuantityForPdf % 2;
            orderTotalFullPriceItems = numberOfPairs + singleItems;
            orderTotalDiscountedItems = numberOfPairs;
        } else {
            orderTotalFullPriceItems = totalQuantityForPdf; // All items are full price if no BOGO
        }
        
        let remainingOrderFullPriceSlots = orderTotalFullPriceItems;
        let remainingOrderDiscountedSlots = orderTotalDiscountedItems;

        // Columnar Order Items
        doc.setFontSize(11); // Heading for the table
        doc.setFont(undefined, 'bold');
        doc.text('Order Items:', margin, yPos); yPos += 7; // Increased space after heading
        
        doc.setFontSize(9); // Smaller font for table content & headers
        // New Column Layout: Description | Color | Qty / Price | Line Total
        const colDescX = margin; // Description starts at margin
        const descMaxWidth = 70;
        const colColorX = colDescX + descMaxWidth + 5; // Allow 5 for padding after desc
        const colorMaxWidth = 45;
        const colDetailsX = colColorX + colorMaxWidth + 5; // Renamed to "Qty / Price", allow 5 for padding after color
        const colLineTotalX = pageWidth - margin;
        // Max width for "Qty / Price" content: colLineTotalX - colDetailsX - (padding for line total text itself e.g. 2)
        const qtyPriceMaxWidth = colLineTotalX - colDetailsX - 2;

        doc.text('Description', colDescX, yPos);
        doc.text('Color', colColorX, yPos);
        doc.text('Qty / Price', colDetailsX, yPos, {align: 'left'});
        doc.text('Line Total', colLineTotalX, yPos, { align: 'right' });
        yPos += 3;
        doc.setLineWidth(0.2);
        doc.line(margin, yPos, pageWidth - margin, yPos); // Underline headers
        yPos += 5;
        doc.setFont(undefined, 'normal');

        selectedOrderItems.forEach((item) => {
            const itemStartY = yPos;
            // Removed PRODUCT_STYLE (Style column)
            doc.text(pageProductTitle, colDescX, itemStartY, { maxWidth: descMaxWidth });
            doc.text(item.color.name, colColorX, itemStartY, { maxWidth: colorMaxWidth });
            // Removed item.quantity.toString() (Qty column)

            let detailY = itemStartY;
            let linesInDetail = 0;
            // Ensuring these are declared and initialized for each item iteration.
            let itemSpecificQtyAtFull = 0;
            let itemSpecificQtyAtBOGO = 0;

            if (currentTierPriceForPdf && totalQuantityForPdf >= MIN_ORDER_QUANTITY) {
                let itemQtyToDistribute = item.quantity;

                if (remainingOrderFullPriceSlots > 0) {
                    const takeForFull = Math.min(itemQtyToDistribute, remainingOrderFullPriceSlots);
                    itemSpecificQtyAtFull = takeForFull;
                    remainingOrderFullPriceSlots -= takeForFull;
                    itemQtyToDistribute -= takeForFull;
                }
                if (itemQtyToDistribute > 0 && remainingOrderDiscountedSlots > 0) {
                    const takeForBOGO = Math.min(itemQtyToDistribute, remainingOrderDiscountedSlots);
                    itemSpecificQtyAtBOGO = takeForBOGO;
                    remainingOrderDiscountedSlots -= takeForBOGO;
                }
                
                // const priceDetailMaxWidth = colLineTotalX - colDetailsX - 2; // This is now qtyPriceMaxWidth, defined above with other col vars

                if (itemSpecificQtyAtFull > 0) {
                    const textLines = doc.splitTextToSize(`${itemSpecificQtyAtFull} units @ $${currentTierPriceForPdf.toFixed(2)}`, qtyPriceMaxWidth);
                    doc.text(textLines, colDetailsX, detailY, { align: 'left' });
                    detailY += (textLines.length * 5); // Increment Y by number of lines
                    linesInDetail += textLines.length;
                }
                if (itemSpecificQtyAtBOGO > 0) {
                    const textLines = doc.splitTextToSize(`${itemSpecificQtyAtBOGO} units @ $${discountedItemPriceForPdf.toFixed(2)} (25% off)`, qtyPriceMaxWidth);
                    doc.text(textLines, colDetailsX, detailY, { align: 'left' });
                    detailY += (textLines.length * 5);
                    linesInDetail += textLines.length;
                }
            } else if (currentTierPriceForPdf) {
                 itemSpecificQtyAtFull = item.quantity;
                 const textLines = doc.splitTextToSize(`${item.quantity} units @ $${currentTierPriceForPdf.toFixed(2)}`, qtyPriceMaxWidth);
                 doc.text(textLines, colDetailsX, detailY, { align: 'left' });
                 detailY += (textLines.length * 5);
                 linesInDetail += textLines.length;
            } else {
                itemSpecificQtyAtFull = item.quantity;
                const fallbackPrice = C112_8000_STITCH_PRICING_TIERS[0]?.price || 0;
                const textLines = doc.splitTextToSize(`${item.quantity} units @ $${fallbackPrice.toFixed(2)} (Std. Price)`, qtyPriceMaxWidth);
                doc.text(textLines, colDetailsX, detailY, { align: 'left' });
                detailY += (textLines.length * 5);
                linesInDetail += textLines.length;
            }
            
            // Calculate and display Line Total for this item
            let lineItemTotal = 0;
            const effectiveTierPrice = currentTierPriceForPdf || (C112_8000_STITCH_PRICING_TIERS[0]?.price || 0);
            const effectiveBogoPrice = discountedItemPriceForPdf || (effectiveTierPrice * 0.75);

            // This calculation now uses itemSpecificQtyAtFull and itemSpecificQtyAtBOGO which are guaranteed to be in scope
            lineItemTotal = (itemSpecificQtyAtFull * effectiveTierPrice) + (itemSpecificQtyAtBOGO * effectiveBogoPrice);
            
            doc.text(`$${lineItemTotal.toFixed(2)}`, colLineTotalX, itemStartY, { align: 'right' });

            // Ensure yPos advances by at least one main line height, or more if sub-lines took space.
            yPos = Math.max(itemStartY + 6, detailY - (linesInDetail > 0 ? 0 : 5) );
            yPos += 2; // Small padding after each item block
        });
        yPos += 8; // Extra space after items list

        // --- 4. Financial Summary ---
        // Recalculate for PDF to ensure accuracy (already done in previous version, good)
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
                doc.text(line, margin + 5, yPos); // Indent breakdown lines
            });
            yPos += 7;
        }
        
        const totalsX = pageWidth / 2 + 20; // X position for totals labels
        const amountsX = pageWidth - margin;  // X position for amounts (right aligned)

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Subtotal (Pre-Discount):`, totalsX, yPos);
        doc.text(`$${pdfGrossSubtotal.toFixed(2)}`, amountsX, yPos, { align: 'right' });
        yPos += 6;
        doc.text(`BOGO Discount:`, totalsX, yPos);
        doc.text(`-$${pdfBogoDiscount.toFixed(2)}`, amountsX, yPos, { align: 'right' });
        yPos += 6;
        doc.setFont(undefined, 'bold');
        doc.text(`Subtotal (Post-Discount):`, totalsX, yPos);
        doc.text(`$${pdfNetSubtotal.toFixed(2)}`, amountsX, yPos, { align: 'right' });
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.text(`Milton Sales Tax (10.1%):`, totalsX, yPos);
        doc.text(`$${pdfTaxAmount.toFixed(2)}`, amountsX, yPos, { align: 'right' });
        yPos += 7;
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setDrawColor(0); // Black line
        doc.line(totalsX - 5, yPos, amountsX, yPos); // Line above grand total
        yPos += 5;
        doc.text(`GRAND TOTAL:`, totalsX, yPos);
        doc.text(`$${pdfGrandTotal.toFixed(2)}`, amountsX, yPos, { align: 'right' });
        doc.setFont(undefined, 'normal');
        yPos += 12; // More space after Grand Total

        // --- Prominent Email Instructions ---
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('To Finalize Your Order or For Questions:', margin, yPos);
        yPos += 7; // Increased spacing
        doc.setFont(undefined, 'normal');
        
        doc.setFont(undefined, 'bold');
        doc.text('Please email this PDF quote to: sales@nwcustomapparel.com', margin, yPos);
        yPos += 7; // Increased spacing
        doc.setFont(undefined, 'normal');

        doc.setFont(undefined, 'bold');
        doc.text('Or contact your sales representative:', margin, yPos);
        yPos += 7; // Increased spacing
        doc.setFont(undefined, 'normal');
        
        const representativeIndent = margin + 4;
        doc.text('Nika: nika@nwcustomapparel.com', representativeIndent, yPos);
        yPos += 6; // Slightly less for sub-items
        doc.text('Taylar: taylar@nwcustomapparel.com', representativeIndent, yPos);
        
        // --- 5. Footer ---
        const footerStartY = pageHeight - margin - 15; // Adjust 15 based on content height
        doc.setLineWidth(0.2);
        doc.line(margin, footerStartY, pageWidth - margin, footerStartY); // Horizontal line above footer
        yPos = footerStartY + 7;

        doc.setFontSize(9);
        doc.text('Northwest Custom Apparel', margin, yPos);
        doc.text('253-922-5793', pageWidth - margin, yPos, {align: 'right'});
        yPos += 5;
        doc.text('2025 Freeman Road East, Milton, WA 98354', margin, yPos);
        // Removed duplicated email info from here, now it's prominent above.
        yPos += 7;
        doc.setFontSize(8);
        doc.text('Minimum order 24 caps. Price includes 8000-stitch embroidery. Quote valid for 30 days.', margin, yPos);

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