/**
 * Shared JavaScript for Pricing Pages v4 (Improved Loading & Dependencies)
 * Handles URL parameters, navigation, Caspio loading, and general UI updates.
 */

console.log("PricingPages: Shared pricing page script loaded (v4).");

(function() {
    "use strict";

    // --- Configuration ---
    const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const FALLBACK_API_BASE_URL = 'https://caspio-pricing-proxy-backup.herokuapp.com';
    let usingFallbackApi = false;

    // --- Global State ---
    window.selectedStyleNumber = null;
    window.selectedColorName = null;
    window.selectedCatalogColor = null;
    window.inventoryData = null;

    // --- Global Functions Called by Caspio ---
    window.initDp5ApiFetch = function() { console.log("PricingPages: initDp5ApiFetch called (DP5)."); return true; };
    window.initDp7ApiFetch = function() { console.log("PricingPages: initDp7ApiFetch called (DP7)."); return true; };
    window.initDp6ApiFetch = function() { console.log("PricingPages: initDp6ApiFetch called (DP6?)."); return true; };
    window.initDp8ApiFetch = function() { console.log("PricingPages: initDp8ApiFetch called (DP8?)."); return true; };


    // --- Helper Functions ---

    function getEmbellishmentTypeFromUrl() {
        const currentPage = window.location.pathname.toLowerCase();
        if (currentPage.includes('cap-embroidery')) return 'cap-embroidery';
        if (currentPage.includes('embroidery')) return 'embroidery';
        if (currentPage.includes('dtg')) return 'dtg';
        if (currentPage.includes('screenprint') || currentPage.includes('screen-print')) return 'screenprint';
        if (currentPage.includes('dtf')) return 'dtf';
        console.warn("PricingPages: Could not determine embellishment type from URL path:", currentPage);
        return 'unknown';
    }

    // normalizeColorName function removed, will use NWCAUtils.normalizeColorName

    // --- Page Initialization Functions ---

    function updateProductContext() {
        const styleNumber = NWCAUtils.getUrlParameter('StyleNumber');
        const colorFromUrl = NWCAUtils.getUrlParameter('COLOR');

        // --- DIAGNOSIS: Check for placeholder values ---
        if (styleNumber === '{styleNumber}' || colorFromUrl === '{colorCode}' || !styleNumber) { // Also check if styleNumber is missing
            console.error("PricingPages: ERROR - URL contains placeholder values or is missing style. Aborting initialization.", { styleNumber, colorFromUrl });
            // Display an error message to the user
            document.body.innerHTML = '<div class="error-message" style="padding: 20px; text-align: center; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 5px; margin: 20px;"><strong>Error:</strong> Invalid product link parameters. Please go back to the product page, ensure a style and color are selected, wait a moment for links to update, and then try the pricing link again.</div>';
            return; // Stop further processing
        }
        // --- End Diagnosis Check ---

        console.log(`PricingPages: Product Context: StyleNumber=${styleNumber}, COLOR=${colorFromUrl}`);

        window.selectedStyleNumber = styleNumber;
        window.selectedColorName = colorFromUrl ? decodeURIComponent(colorFromUrl.replace(/\+/g, ' ')) : null;
        window.selectedCatalogColor = window.selectedColorName; // Default, might be updated by fetchProductDetails/swatch click

        const styleElContext = document.getElementById('product-style-context');
        const colorElContext = document.getElementById('product-color-context');
        if (styleElContext) styleElContext.textContent = styleNumber || 'N/A';
        if (colorElContext) colorElContext.textContent = window.selectedColorName || 'Not Selected';
        
        // Keep updating old elements if they exist for compatibility, or remove if fully deprecated
        const styleElOld = document.getElementById('product-style');
        const colorElOld = document.getElementById('product-color');
        if (styleElOld) styleElOld.textContent = styleNumber || 'N/A';
        if (colorElOld) colorElOld.textContent = window.selectedColorName || 'Not Selected';


        const backLink = document.getElementById('back-to-product');
        if (backLink && styleNumber) {
            backLink.href = `/product?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorFromUrl || '')}`;
        } else if (backLink) {
            backLink.href = '/';
        }

        if (styleNumber) {
            fetchProductDetails(styleNumber); // This will populate swatches and potentially update selectedCatalogColor
        } else {
            const titleElContext = document.getElementById('product-title-context');
            const imageElContext = document.getElementById('product-image-context');
            if (titleElContext) titleElContext.textContent = 'Product Not Found';
            if (imageElContext) imageElContext.src = '';

            const titleElOld = document.getElementById('product-title');
            const imageElOld = document.getElementById('product-image');
            if (titleElOld) titleElOld.textContent = 'Product Not Found';
            if (imageElOld) imageElOld.src = '';
        }
    }

    // Fetches details for the initially selected color to display title, image etc.
    // Relies on dp5-helper.js to fetch and populate the actual color swatches.
    async function fetchProductDetails(styleNumber) {
        console.log(`[fetchProductDetails] Fetching product colors for Style: ${styleNumber} using /api/product-colors`);

        try {
            const apiUrl = `${API_PROXY_BASE_URL}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`;
            console.log(`[fetchProductDetails] Fetching from: ${apiUrl}`);
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`API Error (Product Colors): ${response.status} ${response.statusText}`);
            }
            const productData = await response.json();
            console.log("[fetchProductDetails] Received product colors data:", JSON.stringify(productData, null, 2));

            if (!productData || !productData.colors || productData.colors.length === 0) {
                console.warn("[fetchProductDetails] No colors found in API response for style:", styleNumber);
                // Display some error or default state
                const titleElContext = document.getElementById('product-title-context');
                if (titleElContext) titleElContext.textContent = productData.productTitle || styleNumber || 'Product Not Found';
                // Potentially clear image and swatches or show a "no colors available" message
                return;
            }

            // --- Update Product Title and Description ---
            const titleElContext = document.getElementById('product-title-context');
            if (titleElContext) {
                titleElContext.textContent = productData.productTitle || styleNumber;
            }
            // Assuming a description element might exist, e.g., #product-description-context
            const descriptionElContext = document.getElementById('product-description-context');
            if (descriptionElContext && productData.PRODUCT_DESCRIPTION) {
                descriptionElContext.innerHTML = productData.PRODUCT_DESCRIPTION; // Use innerHTML if description can contain HTML
            }


            // --- Determine Initially Selected Color ---
            const urlColorParam = NWCAUtils.getUrlParameter('COLOR');
            let selectedColorObject = null;

            if (urlColorParam) {
                const decodedUrlColor = decodeURIComponent(urlColorParam.replace(/\+/g, ' '));
                selectedColorObject = productData.colors.find(color =>
                    (color.CATALOG_COLOR && NWCAUtils.normalizeColorName(color.CATALOG_COLOR) === NWCAUtils.normalizeColorName(decodedUrlColor)) ||
                    (color.COLOR_NAME && NWCAUtils.normalizeColorName(color.COLOR_NAME) === NWCAUtils.normalizeColorName(decodedUrlColor))
                );
                if (selectedColorObject) {
                    console.log(`[fetchProductDetails] Matched URL color "${decodedUrlColor}" to:`, selectedColorObject);
                } else {
                    console.warn(`[fetchProductDetails] URL color "${decodedUrlColor}" not found in API response. Defaulting to first color.`);
                }
            }

            if (!selectedColorObject) {
                selectedColorObject = productData.colors[0];
                console.log("[fetchProductDetails] Defaulting to first color:", selectedColorObject);
            }

            // --- Update Global State with selected color ---
            window.selectedColorName = selectedColorObject.COLOR_NAME;
            window.selectedCatalogColor = selectedColorObject.CATALOG_COLOR || selectedColorObject.COLOR_NAME; // Fallback for catalog color
            console.log(`[fetchProductDetails] Globals Set: selectedColorName=${window.selectedColorName}, selectedCatalogColor=${window.selectedCatalogColor}`);

            // --- Update Main Product Image ---
            // Check for new gallery structure first
            const mainImageEl = document.getElementById('product-image-main');
            const imageElContext = document.getElementById('product-image-context');
            
            const mainImageUrl = selectedColorObject.MAIN_IMAGE_URL || selectedColorObject.FRONT_MODEL || '';
            
            if (mainImageEl) {
                // Use new gallery structure
                console.log(`[fetchProductDetails] Using new gallery structure with product-image-main`);
                updateProductImageGallery(selectedColorObject);
            } else if (imageElContext) {
                // Fallback to old structure
                if (mainImageUrl) {
                    imageElContext.src = mainImageUrl;
                    imageElContext.alt = `${productData.productTitle || styleNumber} - ${selectedColorObject.COLOR_NAME}`;
                    console.log(`[fetchProductDetails] Set main image to: ${mainImageUrl}`);
                } else {
                    imageElContext.src = ''; // Clear image if no URL
                    imageElContext.alt = `${productData.productTitle || styleNumber} - ${selectedColorObject.COLOR_NAME}`;
                    console.warn("[fetchProductDetails] No MAIN_IMAGE_URL or FRONT_MODEL for selected color.");
                }
            }

            // --- Update Selected Color Display (Left Column) ---
            const colorElContext = document.getElementById('product-color-context'); // e.g., "Black"
            if (colorElContext) colorElContext.textContent = selectedColorObject.COLOR_NAME;

            const selectedColorSwatchContext = document.getElementById('selected-color-swatch-context'); // The small swatch next to the color name
            if (selectedColorSwatchContext) {
                const swatchImg = selectedColorObject.COLOR_SQUARE_IMAGE || selectedColorObject.COLOR_SWATCH_IMAGE_URL;
                if (swatchImg) {
                    selectedColorSwatchContext.style.backgroundImage = `url('${swatchImg}')`;
                    selectedColorSwatchContext.style.backgroundColor = '';
                } else if (selectedColorObject.HEX_CODE) {
                    selectedColorSwatchContext.style.backgroundImage = '';
                    selectedColorSwatchContext.style.backgroundColor = selectedColorObject.HEX_CODE;
                } else { // Fallback
                    selectedColorSwatchContext.style.backgroundImage = '';
                    selectedColorSwatchContext.style.backgroundColor = NWCAUtils.normalizeColorName(selectedColorObject.COLOR_NAME || 'grey');
                }
            }
            
            // --- Update Mini Swatch/Name in Right-Hand Pricing Column Header ---
            const pricingColorNameEl = document.getElementById('pricing-color-name');
            const pricingColorSwatchEl = document.getElementById('pricing-color-swatch');

            if (pricingColorNameEl) pricingColorNameEl.textContent = selectedColorObject.COLOR_NAME;
            if (pricingColorSwatchEl) {
                const miniSwatchImg = selectedColorObject.COLOR_SQUARE_IMAGE || selectedColorObject.COLOR_SWATCH_IMAGE_URL;
                if (miniSwatchImg) {
                    pricingColorSwatchEl.style.backgroundImage = `url('${miniSwatchImg}')`;
                    pricingColorSwatchEl.style.backgroundColor = '';
                } else if (selectedColorObject.HEX_CODE) {
                    pricingColorSwatchEl.style.backgroundImage = '';
                    pricingColorSwatchEl.style.backgroundColor = selectedColorObject.HEX_CODE;
                } else {
                    pricingColorSwatchEl.style.backgroundImage = '';
                    pricingColorSwatchEl.style.backgroundColor = NWCAUtils.normalizeColorName(selectedColorObject.COLOR_NAME || 'grey');
                }
            }
            // Also call updateMiniColorSwatch to ensure its click listener and other styles are applied
            updateMiniColorSwatch();


            // --- Dispatch event or call function in dp5-helper.js ---
            console.log("[fetchProductDetails] Dispatching productColorsReady event.");
            const eventDetail = {
                colors: productData.colors,
                selectedColor: selectedColorObject
            };
            window.dispatchEvent(new CustomEvent('productColorsReady', { detail: eventDetail }));

            // If dp5-helper.js has an init function that accepts this data directly:
            if (window.DP5Helper && typeof window.DP5Helper.initializeWithColorData === 'function') {
                console.log("[fetchProductDetails] Calling DP5Helper.initializeWithColorData directly.");
                window.DP5Helper.initializeWithColorData(productData.colors, selectedColorObject);
            }


        } catch (error) {
            console.error('[fetchProductDetails] Error fetching product colors:', error);
            const titleElContext = document.getElementById('product-title-context');
            const imageElContext = document.getElementById('product-image-context');
            if (titleElContext) titleElContext.textContent = 'Error Loading Product Info';
            if (imageElContext) imageElContext.src = '';
            // Potentially dispatch an error event or show a user-facing error message
            window.dispatchEvent(new CustomEvent('productColorsError', { detail: { error: error.message } }));
        }
    }

    function populateColorSwatches(colors) {
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) return;
        swatchesContainer.innerHTML = '';

        colors.forEach(color => {
            const swatchWrapper = document.createElement('div');
            swatchWrapper.className = 'swatch-wrapper';
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.colorName = color.COLOR_NAME;
            swatch.dataset.catalogColor = color.CATALOG_COLOR;
            swatch.title = color.COLOR_NAME;
            if (color.COLOR_SWATCH_IMAGE_URL) {
                swatch.style.backgroundImage = `url('${color.COLOR_SWATCH_IMAGE_URL}')`;
            } else {
                swatch.style.backgroundColor = color.COLOR_NAME.toLowerCase().replace(/\s+/g, '');
            }

            // Check against updated global state for active class
            if ((window.selectedCatalogColor && NWCAUtils.normalizeColorName(color.CATALOG_COLOR) === NWCAUtils.normalizeColorName(window.selectedCatalogColor)) ||
                (!window.selectedCatalogColor && window.selectedColorName && NWCAUtils.normalizeColorName(color.COLOR_NAME) === NWCAUtils.normalizeColorName(window.selectedColorName))) // Use NWCAUtils
            {
                swatch.classList.add('active');
            }

            swatch.addEventListener('click', () => handleColorSwatchClick(color));
            const name = document.createElement('span');
            name.className = 'color-name';
            name.textContent = color.COLOR_NAME;
            swatchWrapper.appendChild(swatch);
            swatchWrapper.appendChild(name);
            swatchesContainer.appendChild(swatchWrapper);
        });

        setupShowMoreColorsButton();
    }

    // Fetches details for a specific color and updates the UI accordingly
    async function fetchAndApplyColorSpecificDetails(styleNumber, colorIdentifier) {
         console.log(`[DEBUG] fetchAndApplyColorSpecificDetails called for Style: ${styleNumber}, Color: ${colorIdentifier}`);
         if (!styleNumber || !colorIdentifier) {
              console.error("[DEBUG] Missing styleNumber or colorIdentifier for fetchAndApplyColorSpecificDetails");
              return;
         }
         try {
              const detailApiUrl = `${API_PROXY_BASE_URL}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(colorIdentifier)}`;
              console.log(`[DEBUG] Fetching specific color details from: ${detailApiUrl}`);
              const response = await fetch(detailApiUrl);
              if (!response.ok) throw new Error(`API Error (Specific Color): ${response.status}`);
              const details = await response.json();
              console.log("[DEBUG] Received specific color details:", JSON.stringify(details, null, 2));

              // Update main image using the URL from this specific response
              updateMainProductImage(details.MAIN_IMAGE_URL || details.FRONT_MODEL || details.FRONT_FLAT || '');

              // Update mini swatch (which relies on global state already set by handleColorSwatchClick)
              updateMiniColorSwatch();

         } catch (error) {
              console.error(`[DEBUG] Error fetching specific details for color ${colorIdentifier}:`, error);
              // Optionally handle error, e.g., show a placeholder image or message
         }
    }

    function handleColorSwatchClick(colorData) {
        console.log("[handleColorSwatchClick] Clicked color data:", JSON.stringify(colorData, null, 2));
        if (!colorData || !colorData.COLOR_NAME) {
            console.error("[handleColorSwatchClick] Invalid colorData.");
            return;
        }

        const newColorName = colorData.COLOR_NAME;
        const newCatalogColor = colorData.CATALOG_COLOR || newColorName; // Fallback for catalog color

        // --- Step 1: Update Global State ---
        window.selectedColorName = newColorName;
        window.selectedCatalogColor = newCatalogColor;
        console.log(`[handleColorSwatchClick] Globals updated: selectedColorName=${window.selectedColorName}, selectedCatalogColor=${window.selectedCatalogColor}`);

        // --- Step 2: Update Main Product Image ---
        // Check if we have the new gallery structure
        const mainImageEl = document.getElementById('product-image-main');
        if (mainImageEl) {
            updateProductImageGallery(colorData);
        } else {
            const mainImageUrl = colorData.MAIN_IMAGE_URL || colorData.FRONT_MODEL || '';
            updateMainProductImage(mainImageUrl); // updateMainProductImage already exists and handles #product-image-context
        }

        // --- Step 3: Update Selected Color Display (Left Column) ---
        const colorElContext = document.getElementById('product-color-context');
        if (colorElContext) colorElContext.textContent = newColorName;

        const selectedColorSwatchContext = document.getElementById('selected-color-swatch-context');
        if (selectedColorSwatchContext) {
            const swatchImg = colorData.COLOR_SQUARE_IMAGE || colorData.COLOR_SWATCH_IMAGE_URL;
            if (swatchImg) {
                selectedColorSwatchContext.style.backgroundImage = `url('${swatchImg}')`;
                selectedColorSwatchContext.style.backgroundColor = '';
            } else if (colorData.HEX_CODE) {
                selectedColorSwatchContext.style.backgroundImage = '';
                selectedColorSwatchContext.style.backgroundColor = colorData.HEX_CODE;
            } else {
                selectedColorSwatchContext.style.backgroundImage = '';
                selectedColorSwatchContext.style.backgroundColor = NWCAUtils.normalizeColorName(newColorName || 'grey');
            }
        }
        
        // --- Step 4: Update Mini Swatch/Name in Right-Hand Pricing Column Header ---
        // This is now handled by updateMiniColorSwatch, which should be called.
        // updateMiniColorSwatch internally uses window.selectedColorName and window.selectedCatalogColor
        updateMiniColorSwatch();


        // --- Step 5: Update Active Class on Swatches ---
        const allSwatches = document.querySelectorAll('.color-swatch');
        allSwatches.forEach(s => {
            const sCatalogColor = s.dataset.catalogColor;
            const sColorName = s.dataset.colorName;
            const isActive = (newCatalogColor && sCatalogColor && NWCAUtils.normalizeColorName(sCatalogColor) === NWCAUtils.normalizeColorName(newCatalogColor)) ||
                             (newColorName && sColorName && NWCAUtils.normalizeColorName(sColorName) === NWCAUtils.normalizeColorName(newColorName));
            s.classList.toggle('active', isActive);
        });
        
        // --- Step 6: Update URL and Reload Caspio ---
        const styleNumber = window.selectedStyleNumber;
        if (history.pushState) {
            const newUrl = `${window.location.pathname}?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(newColorName)}`;
            history.pushState({ path: newUrl }, '', newUrl);
            console.log(`[handleColorSwatchClick] URL updated to: ${newUrl}`);
        } else {
            console.warn("[handleColorSwatchClick] history.pushState not supported, URL not updated dynamically.");
        }

        const embType = getEmbellishmentTypeFromUrl();
        const pricingContainerId = CONTAINER_IDS[embType] || 'pricing-calculator';
        const appKeys = CASPIO_APP_KEYS[embType] || [];
        if (styleNumber && appKeys.length > 0) {
             console.log("PricingPages: Reloading Caspio embed for new color...");
             const pricingContainer = document.getElementById(pricingContainerId);
             if (pricingContainer) {
                 pricingContainer.innerHTML = ''; // Clear first
                 delete pricingContainer.dataset.loadFailed;
                 pricingContainer.classList.remove('pricing-unavailable');
                 // Don't await here, let it run async in the background
                 tryLoadCaspioSequentially(pricingContainer, appKeys, styleNumber, embType);
             }
        } else {
             console.warn("PricingPages: Cannot reload Caspio - missing style number or app keys.");
        }

        // --- Step 5: Dispatch Event ---
        window.dispatchEvent(new CustomEvent('colorChanged', { detail: colorData }));
    }

    function updateMainProductImage(imageUrl) {
        console.log(`[DEBUG] updateMainProductImage called with URL: ${imageUrl}`);
        const imageElContext = document.getElementById('product-image-context');
        const imageElOld = document.getElementById('product-image'); // Fallback

        if (imageUrl) {
            if (imageElContext) {
                imageElContext.src = imageUrl;
                console.log(`[DEBUG] Set #product-image-context src to: ${imageUrl}`);
            }
            if (imageElOld) { // Fallback
                imageElOld.src = imageUrl;
                console.log(`[DEBUG] Set #product-image (fallback) src to: ${imageUrl}`);
            }
        } else {
            if (imageElContext) imageElContext.src = '';
            if (imageElOld) imageElOld.src = '';
            console.warn("PricingPages: No image URL provided for selected color swatch. Image not updated.");
        }
         if (!imageElContext && !imageElOld) {
             console.warn("[DEBUG] Neither #product-image-context nor #product-image element found.");
         }
    }
    
    // New function to update product image gallery with all available images
    function updateProductImageGallery(colorData) {
        console.log('[updateProductImageGallery] Updating image gallery with color data:', colorData);
        
        // Check if we have the new gallery structure
        const mainImageEl = document.getElementById('product-image-main');
        const mainImageContainer = document.getElementById('main-image-container');
        const thumbnailsContainer = document.getElementById('image-thumbnails');
        
        if (!mainImageEl || !thumbnailsContainer) {
            console.warn('[updateProductImageGallery] Gallery elements not found, falling back to updateMainProductImage');
            const mainImageUrl = colorData.MAIN_IMAGE_URL || colorData.FRONT_MODEL || '';
            updateMainProductImage(mainImageUrl);
            return;
        }
        
        // Collect all available images
        const images = [];
        
        // Define image types with labels
        const imageTypes = [
            { key: 'FRONT_MODEL', label: 'Front' },
            { key: 'BACK_MODEL', label: 'Back' },
            { key: 'SIDE_MODEL', label: 'Side' },
            { key: 'THREE_Q_MODEL', label: '3/4 View' },
            { key: 'FRONT_FLAT', label: 'Front Flat' },
            { key: 'BACK_FLAT', label: 'Back Flat' }
        ];
        
        // Add main image first if available
        if (colorData.MAIN_IMAGE_URL || colorData.FRONT_MODEL_IMAGE_URL || colorData.FRONT_MODEL) {
            images.push({
                url: colorData.MAIN_IMAGE_URL || colorData.FRONT_MODEL_IMAGE_URL || colorData.FRONT_MODEL,
                label: 'Main',
                isMain: true
            });
        }
        
        // Add other images
        imageTypes.forEach(type => {
            if (colorData[type.key] && colorData[type.key] !== colorData.MAIN_IMAGE_URL) {
                images.push({
                    url: colorData[type.key],
                    label: type.label,
                    isMain: false
                });
            }
        });
        
        console.log('[updateProductImageGallery] Found images:', images);
        
        // Set the main image
        if (images.length > 0) {
            mainImageEl.src = images[0].url;
            mainImageEl.alt = `${window.selectedStyleNumber || 'Product'} - ${window.selectedColorName || ''}`;
            console.log(`[updateProductImageGallery] Set main image src to: ${images[0].url}`);
            
            // Clear and populate thumbnails
            thumbnailsContainer.innerHTML = '';
            
            images.forEach((img, index) => {
                const thumbnailItem = document.createElement('div');
                thumbnailItem.className = 'thumbnail-item';
                if (index === 0) thumbnailItem.classList.add('active');
                
                const thumbnailImg = document.createElement('img');
                thumbnailImg.src = img.url;
                thumbnailImg.alt = img.label;
                
                const thumbnailLabel = document.createElement('div');
                thumbnailLabel.className = 'thumbnail-label';
                thumbnailLabel.textContent = img.label;
                
                thumbnailItem.appendChild(thumbnailImg);
                thumbnailItem.appendChild(thumbnailLabel);
                
                // Add click handler
                thumbnailItem.addEventListener('click', () => {
                    // Update main image
                    mainImageEl.src = img.url;
                    
                    // Update active state
                    thumbnailsContainer.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
                    thumbnailItem.classList.add('active');
                });
                
                thumbnailsContainer.appendChild(thumbnailItem);
            });
            
            // Setup zoom functionality if needed
            setupImageZoomForGallery();
        } else {
            console.warn('[updateProductImageGallery] No images available for this color');
            mainImageEl.src = '';
            mainImageEl.alt = 'No image available';
            
            // Show no images message
            const noImagesMsg = document.createElement('div');
            noImagesMsg.className = 'no-images-message';
            noImagesMsg.textContent = 'No images available for this color';
            thumbnailsContainer.innerHTML = '';
            thumbnailsContainer.appendChild(noImagesMsg);
        }
    }
    
    // Enhanced image zoom for gallery
    function setupImageZoomForGallery() {
        const mainImageContainer = document.getElementById('main-image-container');
        const mainImage = document.getElementById('product-image-main');
        const zoomOverlay = mainImageContainer?.querySelector('.image-zoom-overlay');
        
        if (!mainImageContainer || !mainImage || !zoomOverlay) return;
        
        // Remove existing modal if any
        const existingModal = document.querySelector('.image-zoom-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'image-zoom-modal';
        modal.style.cssText = 'display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.9); overflow:auto;';
        
        const modalContent = document.createElement('img');
        modalContent.className = 'image-zoom-modal-content';
        modalContent.style.cssText = 'margin:auto; display:block; max-width:90%; max-height:90%; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);';
        
        const closeButton = document.createElement('span');
        closeButton.className = 'image-zoom-close';
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = 'position:absolute; top:15px; right:35px; color:#f1f1f1; font-size:40px; font-weight:bold; cursor:pointer;';
        
        modal.appendChild(modalContent);
        modal.appendChild(closeButton);
        document.body.appendChild(modal);
        
        zoomOverlay.addEventListener('click', () => {
            modal.style.display = 'block';
            modalContent.src = mainImage.src;
        });
        
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.style.display = 'none';
        });
    }

    function updateTabNavigation() {
        const styleNumber = NWCAUtils.getUrlParameter('StyleNumber');
        const colorCode = NWCAUtils.getUrlParameter('COLOR');
        const currentPage = window.location.pathname.toLowerCase();
        if (!styleNumber) return;
        const tabs = document.querySelectorAll('.pricing-tab');
        tabs.forEach(tab => {
            const targetPage = tab.getAttribute('data-page');
            if (!targetPage) return;
            const url = `/pricing/${targetPage}?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorCode || '')}`;
            tab.href = url;
            tab.classList.toggle('active', currentPage.includes(`/pricing/${targetPage}`));
        });
    }

    // --- Caspio Loading and Handling ---
    const CASPIO_APP_KEYS = {
        embroidery: ['a0e150001c7143d027a54c439c01'],
        'cap-embroidery': ['a0e150004ecd0739f853449c8d7f'],
        dtg: ['a0e150002eb9491a50104c1d99d7'], // VERIFY
        screenprint: ['a0e1500026349f420e494800b43e'], // VERIFY
        dtf: ['dtf'] // Special key
    };
    const CONTAINER_IDS = {
        embroidery: 'pricing-calculator',
        'cap-embroidery': 'pricing-calculator',
        dtg: 'pricing-calculator',
        screenprint: 'pricing-calculator',
        dtf: 'pricing-calculator'
    };

    function loadCaspioEmbed(containerId, caspioAppKey, styleNumber) {
        const container = document.getElementById(containerId);
        if (!container) { console.error(`PricingPages: Container #${containerId} not found.`); return; }
        if (!styleNumber) { console.error(`PricingPages: Style number missing for Caspio load.`); container.innerHTML = '<div class="error-message">Error: Style number missing.</div>'; container.dataset.loadFailed = 'true'; container.classList.add('pricing-unavailable'); return; }
        const colorForCaspio = window.selectedCatalogColor || window.selectedColorName || '';
        console.log(`PricingPages: Using color for Caspio embed: '${colorForCaspio}'`);
        container.innerHTML = '<div class="loading-message">Loading pricing data...</div>';
        container.classList.add('loading'); container.classList.remove('pricing-unavailable'); delete container.dataset.loadFailed;
        const params = new URLSearchParams(); params.append('StyleNumber', styleNumber); if (colorForCaspio) { params.append('COLOR', colorForCaspio); }

        // ADD PRINT_LOCATION from parent dropdown or global state (set by dtg-adapter.js)
        const embType = getEmbellishmentTypeFromUrl(); // Ensure this function is accessible or pass embType
        if (embType === 'dtg') { // Only add for DTG pages, or make more generic if needed
            const parentLocationDropdown = document.getElementById('parent-dtg-location-select');
            if (parentLocationDropdown && parentLocationDropdown.value) {
                params.append('PRINT_LOCATION', parentLocationDropdown.value);
                console.log(`PricingPages: Adding PRINT_LOCATION from parent dropdown for initial load: ${parentLocationDropdown.value}`);
            } else if (window.currentSelectedPrintLocation) {
                // Fallback to global state if dropdown not found/empty, set by dtg-adapter.js
                params.append('PRINT_LOCATION', window.currentSelectedPrintLocation);
                console.log(`PricingPages: Adding PRINT_LOCATION from global state for initial load: ${window.currentSelectedPrintLocation}`);
            }
        }
        
        const fullUrl = `https://c3eku948.caspio.com/dp/${caspioAppKey}/emb?${params.toString()}`;
        console.log(`PricingPages: Loading Caspio embed from URL: ${fullUrl}`);
        const script = document.createElement('script'); script.type = 'text/javascript'; script.src = fullUrl; script.async = true;
        script.onload = function() { console.log(`PricingPages: Caspio script ${caspioAppKey} loaded from ${fullUrl}`); container.classList.remove('loading'); setTimeout(() => checkCaspioRender(container, caspioAppKey), 5000); };
        script.onerror = function() { console.error(`PricingPages: Error loading Caspio script ${caspioAppKey} from ${fullUrl}`); container.classList.remove('loading'); container.classList.add('pricing-unavailable'); container.dataset.loadFailed = 'true'; };
        container.appendChild(script);
    }

    function checkCaspioRender(container, caspioAppKey) {
         console.log(`PricingPages: Performing check for ${caspioAppKey} after delay...`);
         const hasExplicitError = /Error:|Failed to load|Unable to load|Initializing script \(1\) not found/i.test(container.innerText);
         const noRecordsFound = container.innerText.includes('No records found');
         const hasTableContent = !!container.querySelector('table tbody tr') || !!container.querySelector('.cbResultSetTable') || !!container.querySelector('.matrix-price-table');
         const isLoadingMessageStillPresent = !!container.querySelector('.loading-message');
         console.log(`PricingPages: Check details - hasExplicitError: ${hasExplicitError}, noRecordsFound: ${noRecordsFound}, hasTableContent: ${hasTableContent}, isLoadingMessageStillPresent: ${isLoadingMessageStillPresent}`);
         if (noRecordsFound) { console.log(`PricingPages: Caspio loaded for ${caspioAppKey}, but no records found. Displaying contact message.`); container.dataset.loadFailed = 'true'; container.classList.add('pricing-unavailable'); displayContactMessage(container, getEmbellishmentTypeFromUrl()); initializeFallbackPricingData(getEmbellishmentTypeFromUrl()); }
         else if (hasExplicitError || (!hasTableContent && isLoadingMessageStillPresent)) { console.warn(`PricingPages: Caspio check FAILED for ${caspioAppKey}.`); container.dataset.loadFailed = 'true'; container.classList.add('pricing-unavailable'); }
         else if (hasTableContent) { console.log(`PricingPages: Caspio check PASSED for ${caspioAppKey}. Table content found.`); container.classList.remove('pricing-unavailable'); container.dataset.loadFailed = 'false'; ensureHiddenCartElements(container); console.log(`PricingPages: Caspio content detected, pricing-matrix-capture.js should handle data extraction.`); const loadingMsg = container.querySelector('.loading-message'); if (loadingMsg) loadingMsg.style.display = 'none'; }
         else { console.warn(`PricingPages: Caspio check AMBIGUOUS for ${caspioAppKey}. Treating as 'No Records'.`); container.dataset.loadFailed = 'true'; container.classList.add('pricing-unavailable'); displayContactMessage(container, getEmbellishmentTypeFromUrl()); initializeFallbackPricingData(getEmbellishmentTypeFromUrl()); }
    }

    async function tryLoadCaspioSequentially(container, appKeys, styleNumber, embType) {
        console.log(`PricingPages: Starting sequential load for ${embType} with keys:`, appKeys);
        let loadedSuccessfully = false;
        for (let i = 0; i < appKeys.length; i++) {
            const currentKey = appKeys[i];
            console.log(`PricingPages: Attempting load for ${embType} with key #${i + 1}: ${currentKey}`);
            loadCaspioEmbed(container.id, currentKey, styleNumber);
            await new Promise(resolve => setTimeout(resolve, 6000));
            const loadFailed = container.dataset.loadFailed === 'true';
            if (!loadFailed) { console.log(`PricingPages: Successfully loaded ${embType} pricing with key: ${currentKey}`); loadedSuccessfully = true; break; }
            else { console.warn(`PricingPages: Failed to load ${embType} pricing with key: ${currentKey}.`); if (i < appKeys.length - 1) console.log("PricingPages: Trying next key..."); }
        }
        if (!loadedSuccessfully) { console.error(`PricingPages: All attempts to load ${embType} pricing failed.`); displayContactMessage(container, embType); initializeFallbackPricingData(embType); }
    }

    function ensureHiddenCartElements(container) {
        if (!container.querySelector('#matrix-title')) { const titleElement = document.createElement('h3'); titleElement.id = 'matrix-title'; const caspioTitle = container.querySelector('h3, h2'); titleElement.textContent = caspioTitle ? caspioTitle.textContent.trim() : `${getEmbellishmentTypeFromUrl()} Pricing`; titleElement.style.display = 'none'; container.insertBefore(titleElement, container.firstChild); }
        if (!container.querySelector('#matrix-note')) { const noteElement = document.createElement('div'); noteElement.id = 'matrix-note'; noteElement.style.display = 'none'; const caspioNote = container.querySelector('.cbResultSetInstructions, .cbResultSetMessage'); noteElement.innerHTML = caspioNote ? caspioNote.innerHTML : ''; container.appendChild(noteElement); }
    }

    // --- Script Loading Helper ---

    async function loadScript(src) {
        return new Promise((resolve, reject) => {
            let alreadyLoaded = false;
            // Check based on known global objects/flags
            if (src.includes('cart.js') && window.NWCACart) alreadyLoaded = true;
            else if (src.includes('cart-integration.js') && window.cartIntegrationInitialized) alreadyLoaded = true;
            else if (src.includes('pricing-matrix-capture.js') && window.PricingMatrixCapture) alreadyLoaded = true;
            else if (src.includes('pricing-calculator.js') && window.NWCAPricingCalculator) alreadyLoaded = true;
            else if (src.includes('product-quantity-ui.js') && window.ProductQuantityUI) alreadyLoaded = true;
            else if (src.includes('add-to-cart.js') && window.addToCartInitialized) alreadyLoaded = true;
            else if (src.includes('order-form-pdf.js') && window.NWCAOrderFormPDF) alreadyLoaded = true;

            if (alreadyLoaded) {
                console.log(`PricingPages: Script ${src} already loaded.`);
                resolve(); return;
            }

            console.log(`PricingPages: Loading script ${src}...`);
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // Ensure sequential execution relative to other scripts added this way

            script.onload = () => {
                console.log(`PricingPages: Script ${src} loaded successfully.`);
                if (src.includes('cart.js')) {
                     setTimeout(() => { // Give cart.js a moment
                         if (window.NWCACart?.initializeCart) {
                              try { window.NWCACart.initializeCart(); } catch (e) { console.error('Error initializing NWCACart:', e); }
                         }
                         resolve();
                     }, 50);
                } else {
                     resolve();
                }
            };
            script.onerror = () => { console.error(`PricingPages: Error loading script ${src}.`); reject(new Error(`Failed to load script ${src}`)); };
            document.body.appendChild(script); // Append to body to ensure execution order after HTML
        });
    }


    // --- UI Update Functions (Consolidated) ---

    function updatePriceDisplayForSize(size, quantity, unitPrice, displayPrice, itemTotal, ltmFeeApplies, ltmFeePerItem, combinedQuantity, ltmFee, hasBackLogo, backLogoPerItem, frontStitchCount) {
        // console.log(`[DEBUG_LTM] updatePriceDisplayForSize PARAMS for ${size}:`, {
        //     size, quantity, unitPrice, displayPrice, itemTotal, ltmFeeApplies, ltmFeePerItem, combinedQuantity, ltmFee, hasBackLogo, backLogoPerItem, frontStitchCount
        // });
        // Try multiple selectors to find the correct price display cell for this size
        // First try the new pricing box row structure
        let matrixPriceDisplay = document.querySelector(`#price-box-row .price-display[data-size="${size}"]`);
        
        // If not found, try alternative selectors for backward compatibility
        if (!matrixPriceDisplay) {
            matrixPriceDisplay = document.querySelector(`#quantity-matrix .price-display[data-size="${size}"]`);
        }
        if (!matrixPriceDisplay) {
            matrixPriceDisplay = document.querySelector(`.quantity-input-table .price-display[data-size="${size}"]`);
        }
        if (!matrixPriceDisplay) {
            matrixPriceDisplay = document.querySelector(`[data-size="${size}"].price-display`);
        }
        
        console.log(`[updatePriceDisplayForSize] Looking for price display for size: ${size}, found:`, matrixPriceDisplay);
        const formattedFrontStitchCount = frontStitchCount ? ` (${parseInt(frontStitchCount).toLocaleString()} st)` : '';

        if (matrixPriceDisplay) {
            // Use the passed parameters for back logo info, with fallback to checking global if not provided
            if (hasBackLogo === undefined || backLogoPerItem === undefined) {
                // Fallback to checking global for backward compatibility
                backLogoPerItem = 0;
                hasBackLogo = false;
                if (window.CapEmbroideryBackLogo && typeof window.CapEmbroideryBackLogo.isEnabled === 'function' && window.CapEmbroideryBackLogo.isEnabled()) {
                    backLogoPerItem = window.CapEmbroideryBackLogo.getPrice();
                    hasBackLogo = true;
                }
            }
            
            console.log(`[updatePriceDisplayForSize] Size: ${size}, hasBackLogo: ${hasBackLogo}, backLogoPerItem: ${backLogoPerItem}, frontStitches: ${frontStitchCount}`);
            
            const actualDisplayPrice = displayPrice; // displayPrice from calculator already includes backLogoPerItem
            matrixPriceDisplay.dataset.unitPrice = unitPrice.toFixed(2);
            matrixPriceDisplay.dataset.displayPrice = actualDisplayPrice.toFixed(2);
            
            if (quantity <= 0) {
                // For zero quantity, show the base price plus back logo if applicable
                const zeroQtyPrice = hasBackLogo ? (unitPrice + backLogoPerItem) : unitPrice;
                matrixPriceDisplay.innerHTML = `$${zeroQtyPrice.toFixed(2)}`;
                matrixPriceDisplay.className = 'price-display'; // Reset classes
                matrixPriceDisplay.style.backgroundColor = '';
                matrixPriceDisplay.style.padding = '';
                matrixPriceDisplay.style.border = '';
            } else {
                let cardHtml = '';
                
                if (ltmFeeApplies) {
                    const actualItemTotal = actualDisplayPrice * quantity;
                    
                    // Modified to make the card more compact and fit within column
                    cardHtml += `
                        <div class="price-breakdown-card ltm-active" style="width:100%; max-width:140px; display:flex; flex-direction:column; margin:0 auto;">
                            <div class="price-breakdown-header" style="text-align:center; font-size:0.8em; padding:2px 4px;">LTM Fee Applied</div>
                            <div style="padding:3px 6px;">
                                <div class="price-breakdown-row" style="padding:1px 0; font-size:0.75em;"><span>Base${formattedFrontStitchCount}:</span> <span>$${unitPrice.toFixed(2)}</span></div>`;
               
               // Ensure LTM fee per item is displayed if it's greater than zero
               if (ltmFeeApplies && ltmFeePerItem > 0) {
                   cardHtml += `<div class="price-breakdown-row" style="padding:1px 0; font-size:0.75em;"><span>LTM:</span> <span style="color: #dc3545; font-weight: bold;">+$${ltmFeePerItem.toFixed(2)}</span></div>`;
               }
               
               if (hasBackLogo) {
                        const backLogoStitchCount = window.CapEmbroideryBackLogo && window.CapEmbroideryBackLogo.getStitchCount ? window.CapEmbroideryBackLogo.getStitchCount() : '';
                        const formattedBackStitchCount = backLogoStitchCount ? ` (${parseInt(backLogoStitchCount).toLocaleString()} st)` : '';
                        cardHtml += `<div class="price-breakdown-row" style="padding:1px 0; font-size:0.75em;"><span>Back Logo${formattedBackStitchCount}:</span> <span>+$${backLogoPerItem.toFixed(2)}</span></div>`;
                    }
                    
                    cardHtml += `
                                <div class="price-breakdown-row unit-price" style="padding:1px 0; font-size:0.8em; font-weight:bold;"><span>Unit:</span> <span>$${actualDisplayPrice.toFixed(2)}</span></div>
                                <div class="price-breakdown-row total-price" style="padding:1px 0; font-size:0.8em; font-weight:bold; border-top:1px solid #ddd; margin-top:2px; padding-top:2px;"><span>Total (${quantity}):</span> <span>$${actualItemTotal.toFixed(2)}</span></div>
                            </div>
                        </div>`;
                } else {
                    const actualItemTotal = actualDisplayPrice * quantity;
                    
                    // Modified to make the card more compact and fit within column
                    cardHtml = `
                        <div class="price-breakdown-card standard" style="width:100%; max-width:140px; display:flex; flex-direction:column; margin:0 auto;">
                            <div class="price-breakdown-header" style="text-align:center; font-size:0.8em; padding:2px 4px;">Standard Price</div>
                            <div style="padding:3px 6px;">
                                <div class="price-breakdown-row" style="padding:1px 0; font-size:0.75em;"><span>Base${formattedFrontStitchCount}:</span> <span>$${unitPrice.toFixed(2)}</span></div>`;
                    
                    if (hasBackLogo) {
                        const backLogoStitchCount = window.CapEmbroideryBackLogo && window.CapEmbroideryBackLogo.getStitchCount ? window.CapEmbroideryBackLogo.getStitchCount() : '';
                        const formattedBackStitchCount = backLogoStitchCount ? ` (${parseInt(backLogoStitchCount).toLocaleString()} st)` : '';
                        cardHtml += `<div class="price-breakdown-row" style="padding:1px 0; font-size:0.75em;"><span>Back Logo${formattedBackStitchCount}:</span> <span>+$${backLogoPerItem.toFixed(2)}</span></div>`;
                    }
                    
                    cardHtml += `
                                <div class="price-breakdown-row unit-price" style="padding:1px 0; font-size:0.8em; font-weight:bold;"><span>Unit:</span> <span>$${actualDisplayPrice.toFixed(2)}</span></div>
                                <div class="price-breakdown-row total-price" style="padding:1px 0; font-size:0.8em; font-weight:bold; border-top:1px solid #ddd; margin-top:2px; padding-top:2px;"><span>Total (${quantity}):</span> <span>$${actualItemTotal.toFixed(2)}</span></div>
                            </div>
                        </div>`;
                }
                // console.log(`[DEBUG_LTM] updatePriceDisplayForSize - Generated cardHtml for ${size} (Qty: ${quantity}):\n`, cardHtml);
                matrixPriceDisplay.innerHTML = cardHtml;
                matrixPriceDisplay.className = 'price-display has-breakdown';
                matrixPriceDisplay.style.backgroundColor = '';
                matrixPriceDisplay.style.padding = '0';
                matrixPriceDisplay.style.border = 'none';
            }
            matrixPriceDisplay.dataset.quantity = quantity;
            matrixPriceDisplay.dataset.tier = window.cartItemData?.tierKey || '';
        }
        const gridPriceDisplay = document.querySelector(`#size-quantity-grid-container .size-price[data-size="${size}"]`);
        if (gridPriceDisplay) {
            if (quantity <= 0) {
                const zeroQtyPrice = hasBackLogo ? (unitPrice + backLogoPerItem) : unitPrice;
                gridPriceDisplay.textContent = `$${zeroQtyPrice.toFixed(2)}`;
                gridPriceDisplay.style.backgroundColor = '';
                gridPriceDisplay.style.padding = '';
                gridPriceDisplay.style.borderRadius = '';
                gridPriceDisplay.style.border = '';
                gridPriceDisplay.style.boxShadow = '';
                gridPriceDisplay.style.fontWeight = '';
                gridPriceDisplay.style.color = '';
            } else {
                let priceHTML = '';
                
                if (ltmFeeApplies) {
                    const actualDisplayPrice = displayPrice; // Already includes back logo from calculator
                    const actualItemTotal = actualDisplayPrice * quantity;
                    
                    priceHTML = `<div style="font-weight:bold;color:#212529;background-color:#ffc107;margin-bottom:5px;padding:3px;border-radius:4px;text-align:center;">⚠️ LTM FEE ⚠️</div>`;
                    priceHTML += `<div>Base${formattedFrontStitchCount}: $${unitPrice.toFixed(2)}`;
                    
                    if (hasBackLogo && backLogoPerItem > 0) {
                         const backLogoStitchCount = window.CapEmbroideryBackLogo && window.CapEmbroideryBackLogo.getStitchCount ? window.CapEmbroideryBackLogo.getStitchCount() : '';
                         const formattedBackStitchCount = backLogoStitchCount ? ` (${parseInt(backLogoStitchCount).toLocaleString()} st)` : '';
                        priceHTML += ` + <strong style="color:#0056b3">$${backLogoPerItem.toFixed(2)}</strong> BL${formattedBackStitchCount}`;
                    }
                    
                    priceHTML += ` + <strong style="color:#663c00">$${ltmFeePerItem.toFixed(2)}</strong> LTM</div>`;
                    priceHTML += `<div><strong style="font-size:1.1em;">$${actualItemTotal.toFixed(2)}</strong></div>`;
                    priceHTML += `<div style="background-color:#fff3cd;padding:3px;margin-top:3px;border-radius:3px;"><small>($${ltmFee.toFixed(2)} fee ÷ ${combinedQuantity} items)</small></div>`;
                    
                    gridPriceDisplay.innerHTML = priceHTML;
                    gridPriceDisplay.style.backgroundColor = '#fff3cd';
                    gridPriceDisplay.style.padding = '8px';
                    gridPriceDisplay.style.borderRadius = '4px';
                    gridPriceDisplay.style.border = '2px solid #dc3545';
                    gridPriceDisplay.style.boxShadow = '0 0 5px rgba(220, 53, 69, 0.3)';
                } else {
                    const actualDisplayPrice = displayPrice; // Already includes back logo from calculator
                    
                    if (hasBackLogo && backLogoPerItem > 0) {
                        const backLogoStitchCount = window.CapEmbroideryBackLogo && window.CapEmbroideryBackLogo.getStitchCount ? window.CapEmbroideryBackLogo.getStitchCount() : '';
                        const formattedBackStitchCount = backLogoStitchCount ? ` (${parseInt(backLogoStitchCount).toLocaleString()} st)` : '';
                        priceHTML = `<div style="font-size:0.85em;color:#666;">Base${formattedFrontStitchCount}: $${unitPrice.toFixed(2)}</div>`;
                        priceHTML += `<div style="font-size:0.85em;color:#0056b3;">+BL${formattedBackStitchCount}: $${backLogoPerItem.toFixed(2)}</div>`;
                        priceHTML += `<div style="font-weight:bold;font-size:1.1em;margin-top:2px;">$${actualDisplayPrice.toFixed(2)}</div>`;
                        
                        gridPriceDisplay.innerHTML = priceHTML;
                        gridPriceDisplay.style.backgroundColor = '#e8f5e9';
                        gridPriceDisplay.style.padding = '4px 8px';
                        gridPriceDisplay.style.borderRadius = '4px';
                        gridPriceDisplay.style.border = '1px solid #4caf50';
                        gridPriceDisplay.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        gridPriceDisplay.style.fontWeight = 'normal';
                        gridPriceDisplay.style.color = '#2e7d32';
                    } else {
                        gridPriceDisplay.textContent = `$${actualDisplayPrice.toFixed(2)}`;
                        gridPriceDisplay.style.backgroundColor = '#e8f5e9';
                        gridPriceDisplay.style.padding = '4px 8px';
                        gridPriceDisplay.style.borderRadius = '4px';
                        gridPriceDisplay.style.border = '1px solid #4caf50';
                        gridPriceDisplay.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        gridPriceDisplay.style.fontWeight = 'bold';
                        gridPriceDisplay.style.color = '#2e7d32';
                    }
                }
            }
            gridPriceDisplay.dataset.quantity = quantity;
            gridPriceDisplay.dataset.unitPrice = unitPrice;
            gridPriceDisplay.dataset.displayPrice = displayPrice; // Store the original displayPrice from calculator
            gridPriceDisplay.dataset.tier = window.cartItemData?.tierKey || '';
        }
    }

    function showSuccessWithViewCartButton(productData) {
        const existingContainer = document.getElementById('cart-notification-container'); if (existingContainer) document.body.removeChild(existingContainer); const notificationContainer = document.createElement('div'); notificationContainer.id = 'cart-notification-container'; notificationContainer.style.position = 'fixed'; notificationContainer.style.top = '20px'; notificationContainer.style.right = '20px'; notificationContainer.style.zIndex = '9999'; notificationContainer.style.width = '300px'; notificationContainer.style.maxWidth = '90%'; const ltmFeeApplied = productData?.pricingInfo?.ltmFeeApplied || false; if (ltmFeeApplied) { const ltmInfoBadge = document.createElement('div'); ltmInfoBadge.className = 'ltm-info-badge'; ltmInfoBadge.style.position = 'absolute'; ltmInfoBadge.style.top = '-15px'; ltmInfoBadge.style.right = '10px'; ltmInfoBadge.style.backgroundColor = '#ffc107'; ltmInfoBadge.style.color = '#212529'; ltmInfoBadge.style.padding = '3px 10px'; ltmInfoBadge.style.borderRadius = '15px'; ltmInfoBadge.style.fontSize = '0.75em'; ltmInfoBadge.style.fontWeight = 'bold'; ltmInfoBadge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; ltmInfoBadge.textContent = '⚠️ LTM Fee Applied'; notificationContainer.appendChild(ltmInfoBadge); } document.body.appendChild(notificationContainer); const notification = document.createElement('div'); notification.className = 'cart-notification'; notification.style.backgroundColor = '#fff'; notification.style.borderRadius = '8px'; notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; notification.style.marginBottom = '10px'; notification.style.overflow = 'hidden'; notification.style.animation = 'slideIn 0.3s ease-out forwards'; if (!document.getElementById('cart-notification-styles')) { const styleEl = document.createElement('style'); styleEl.id = 'cart-notification-styles'; styleEl.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes fadeOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } } .cart-notification.removing { animation: fadeOut 0.3s ease-in forwards; } .ltm-fee-notification { box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3); border: 1px solid #ffc107; } .ltm-info-badge { animation: pulse 2s infinite; } @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`; document.head.appendChild(styleEl); } const styleNumber = productData?.styleNumber || 'N/A'; const colorCode = productData?.color || 'N/A'; const embType = productData?.embellishmentType || 'N/A'; const totalQuantity = productData?.totalQuantity || 0; const sizes = productData?.sizes || []; const sizeText = sizes.map(size => `${size.size}: ${size.quantity}`).join(', '); const totalPrice = sizes.reduce((sum, size) => sum + (size.totalPrice || 0), 0); let statusBgColor = '#28a745'; let statusIcon = '✓'; let statusMessage = 'Added to Cart'; let textColor = 'white'; if (ltmFeeApplied) { statusBgColor = '#ffc107'; statusIcon = '⚠️'; statusMessage = 'Added with LTM Fee'; textColor = '#212529'; notification.classList.add('ltm-fee-notification'); } notification.innerHTML = `<div style="background-color:${statusBgColor};color:${textColor};padding:10px;display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;"><span style="font-size:16px;margin-right:8px;">${statusIcon}</span><span style="font-weight:bold;">${statusMessage}</span></div><button class="close-notification" style="background:none;border:none;color:${textColor};font-size:18px;cursor:pointer;padding:0;line-height:1;">×</button></div><div style="padding:15px;"><div style="margin-bottom:10px;font-weight:bold;font-size:16px;">Item Added</div><div style="display:flex;margin-bottom:12px;"><div style="flex:0 0 80px;height:80px;margin-right:10px;border:1px solid #e9ecef;overflow:hidden;display:flex;align-items:center;justify-content:center;background-color:#f8f9fa;">${productData.imageUrl ? `<img src="${productData.imageUrl}" alt="${styleNumber} ${colorCode}" style="max-width:100%;max-height:100%;object-fit:contain;">` : `<div style="display:flex;align-items:center;justify-content:center;font-size:11px;text-align:center;color:#6c757d;flex-direction:column;"><span>${styleNumber}</span><span>${colorCode}</span></div>`}</div><div style="flex:1;"><div style="margin-bottom:4px;font-weight:bold;">Style #${styleNumber}</div><div style="margin-bottom:4px;color:#6c757d;">Color: ${colorCode}</div><div style="margin-bottom:4px;color:#6c757d; text-transform: capitalize;">${embType.replace('-', ' ')}</div></div></div><div style="background-color:${ltmFeeApplied ? '#fff3cd' : '#f8f9fa'};padding:8px;border-radius:4px;margin-bottom:12px;border:${ltmFeeApplied ? '1px solid #ffc107' : '1px solid #eee'};"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Quantity:</span><span>${totalQuantity}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Sizes:</span><span style="text-align:right;max-width:70%;">${sizeText || 'N/A'}</span></div><div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Total:</span><span>$${totalPrice.toFixed(2)}</span></div></div><div style="display:flex;justify-content:space-between;"><button class="continue-shopping" style="padding:8px 16px;background-color:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;cursor:pointer;">Continue Shopping</button><button class="view-cart" style="padding:8px 16px;background-color:${ltmFeeApplied ? '#ffc107' : '#0056b3'};color:${ltmFeeApplied ? '#212529' : 'white'};border:none;border-radius:4px;cursor:pointer;font-weight:bold;">View Cart</button></div></div>`; function removeNotification(notif) { if (!notif || !notif.parentNode || notif.classList.contains('removing')) return; notif.classList.add('removing'); notif.addEventListener('animationend', function() { if (notif.parentNode) { notif.parentNode.removeChild(notif); if (notificationContainer.children.length === 0 && notificationContainer.parentNode) { notificationContainer.parentNode.removeChild(notificationContainer); } } }); setTimeout(() => { if (notif.parentNode) { notif.parentNode.removeChild(notif); if (notificationContainer.children.length === 0 && notificationContainer.parentNode) { notificationContainer.parentNode.removeChild(notificationContainer); } } }, 500); } notification.querySelector('.close-notification').addEventListener('click', () => removeNotification(notification)); notification.querySelector('.continue-shopping').addEventListener('click', () => removeNotification(notification)); notification.querySelector('.view-cart').addEventListener('click', () => { if (window.NWCACart?.openCart) window.NWCACart.openCart(); else window.location.href = '/cart'; removeNotification(notification); }); notificationContainer.appendChild(notification); setTimeout(() => removeNotification(notification), 6000);
    }

    function handleMobileAdjustments() {
        const isMobile = window.innerWidth <= 768; const isSmallMobile = window.innerWidth <= 480; const useGrid = window.ProductQuantityUI ? determineLayoutPreference() : false; console.log(`PricingPages: Handling mobile adjustments. isMobile: ${isMobile}, isSmallMobile: ${isSmallMobile}, useGridPreference: ${useGrid}`); const colorSwatches = document.querySelectorAll('.color-swatch'); colorSwatches.forEach(swatch => { const size = isSmallMobile ? '45px' : (isMobile ? '50px' : '60px'); swatch.style.width = size; swatch.style.height = size; }); const pricingGrid = document.getElementById('custom-pricing-grid'); if (pricingGrid) { pricingGrid.classList.toggle('mobile-view', isMobile); pricingGrid.style.fontSize = isSmallMobile ? '0.8em' : (isMobile ? '0.9em' : ''); const pricingGridContainer = document.querySelector('.pricing-grid-container'); if (pricingGridContainer) { pricingGridContainer.style.overflowX = isMobile ? 'auto' : ''; pricingGridContainer.style.WebkitOverflowScrolling = isMobile ? 'touch' : ''; } } const productContext = document.querySelector('.product-context'); if (productContext) { productContext.style.flexDirection = isMobile ? 'column' : ''; productContext.style.textAlign = isMobile ? 'center' : ''; } const quantityMatrixContainer = document.getElementById('quantity-matrix'); const sizeQuantityGridContainer = document.getElementById('size-quantity-grid-container'); if (quantityMatrixContainer) { quantityMatrixContainer.style.display = (!useGrid && !isSmallMobile) ? 'block' : 'none'; if (!useGrid && !isSmallMobile) { const matrixTable = quantityMatrixContainer.querySelector('.quantity-input-table'); if (matrixTable) matrixTable.classList.toggle('mobile-view', isMobile); } } if (sizeQuantityGridContainer) { sizeQuantityGridContainer.style.display = (useGrid || isSmallMobile) ? 'grid' : 'none'; if (useGrid || isSmallMobile) { sizeQuantityGridContainer.style.gridTemplateColumns = isSmallMobile ? '1fr' : (isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))'); } } const visibleContainerSelector = (useGrid || isSmallMobile) ? '#size-quantity-grid-container' : '#quantity-matrix'; const visibleContainer = document.querySelector(visibleContainerSelector); if (visibleContainer) { visibleContainer.querySelectorAll('.quantity-btn').forEach(btn => { const size = isSmallMobile ? '22px' : (isMobile ? '24px' : '26px'); const fontSize = isSmallMobile ? '0.8em' : (isMobile ? '0.9em' : '1em'); btn.style.width = size; btn.style.height = size; btn.style.fontSize = fontSize; }); visibleContainer.querySelectorAll('.quantity-input').forEach(input => { const width = isSmallMobile ? '30px' : (isMobile ? '35px' : '40px'); const height = isSmallMobile ? '22px' : (isMobile ? '24px' : '26px'); const fontSize = isSmallMobile ? '0.8em' : (isMobile ? '0.9em' : '1em'); input.style.width = width; input.style.height = height; input.style.fontSize = fontSize; }); if (visibleContainerSelector === '#size-quantity-grid-container') { visibleContainer.querySelectorAll('.size-quantity-item').forEach(item => { item.style.padding = isSmallMobile ? '8px' : '10px'; }); } else if (visibleContainerSelector === '#quantity-matrix') { visibleContainer.querySelectorAll('th, td').forEach(cell => { cell.style.padding = isSmallMobile ? '4px' : (isMobile ? '6px' : '8px'); }); } } const cartSummary = document.querySelector('.cart-summary'); if (cartSummary) { cartSummary.style.padding = isMobile ? '15px' : '20px'; const addToCartButton = cartSummary.querySelector('#add-to-cart-button'); if (addToCartButton) { addToCartButton.style.padding = isSmallMobile ? '8px 16px' : '12px 24px'; addToCartButton.style.fontSize = isSmallMobile ? '1em' : '1.1em'; } const tierInfoDisplayInSummary = cartSummary.querySelector('.pricing-tier-info'); if (tierInfoDisplayInSummary) { tierInfoDisplayInSummary.style.padding = isSmallMobile ? '8px' : '10px'; tierInfoDisplayInSummary.style.fontSize = isSmallMobile ? '0.85em' : '0.9em'; const progressBar = tierInfoDisplayInSummary.querySelector('.tier-progress'); if(progressBar) { /* Optional: progressBar.style.height = isSmallMobile ? '6px' : '8px'; */ } const progressBarFill = tierInfoDisplayInSummary.querySelector('.tier-progress-fill'); if(progressBarFill) { /* Optional: progressBarFill.style.height = isSmallMobile ? '6px' : '8px'; */ } } } const mainPricingTierInfo = document.querySelector('.product-interactive-column .pricing-tier-info'); if (mainPricingTierInfo && mainPricingTierInfo !== cartSummary?.querySelector('.pricing-tier-info')) { mainPricingTierInfo.style.padding = isMobile ? '10px' : '15px'; mainPricingTierInfo.style.fontSize = isSmallMobile ? '0.85em' : '0.9em'; } setupShowMoreColorsButton();
    }

    // --- UI Initialization Functions (Moved from inline scripts) ---

    function setupTabs() {
        const tabHeaders = document.querySelectorAll('.tab-header'); const tabPanes = document.querySelectorAll('.tab-pane'); if (!tabHeaders.length || !tabPanes.length) return; tabHeaders.forEach(header => { header.addEventListener('click', function() { tabHeaders.forEach(h => h.classList.remove('active')); tabPanes.forEach(p => p.classList.remove('active')); this.classList.add('active'); const tabId = this.getAttribute('data-tab'); const targetPane = document.getElementById(tabId); if (targetPane) targetPane.classList.add('active'); }); }); console.log("PricingPages: Tab functionality initialized.");
    }

    function setupInventoryLegend() {
        const hasLowInventory = window.inventoryData && window.inventoryData.sizeTotals && window.inventoryData.sizeTotals.some(qty => qty > 0 && qty < 10); const legend = document.querySelector('.inventory-indicator-legend'); if (legend) { legend.style.display = hasLowInventory ? 'block' : 'none'; console.log(`PricingPages: Inventory legend display set to ${hasLowInventory ? 'block' : 'none'}.`); }
    }

    function setupImageZoom() {
        const imageContainer = document.querySelector('.product-image-container'); const image = document.getElementById('product-image'); const zoomOverlay = document.querySelector('.image-zoom-overlay'); if (!imageContainer || !image || !zoomOverlay) return; if (document.querySelector('.image-zoom-modal')) return; const modal = document.createElement('div'); modal.className = 'image-zoom-modal'; modal.style.cssText = 'display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.9); overflow:auto;'; const modalContent = document.createElement('img'); modalContent.className = 'image-zoom-modal-content'; modalContent.style.cssText = 'margin:auto; display:block; max-width:90%; max-height:90%; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);'; const closeButton = document.createElement('span'); closeButton.className = 'image-zoom-close'; closeButton.innerHTML = '&times;'; closeButton.style.cssText = 'position:absolute; top:15px; right:35px; color:#f1f1f1; font-size:40px; font-weight:bold; cursor:pointer;'; modal.appendChild(modalContent); modal.appendChild(closeButton); document.body.appendChild(modal); zoomOverlay.addEventListener('click', () => { modal.style.display = 'block'; modalContent.src = image.src; }); closeButton.addEventListener('click', () => { modal.style.display = 'none'; }); modal.addEventListener('click', (event) => { if (event.target === modal) modal.style.display = 'none'; }); console.log("PricingPages: Image zoom functionality initialized.");
    }

    function setupShowMoreColorsButton() {
        const showMoreButton = document.getElementById('show-more-colors'); const colorSwatchesContainer = document.getElementById('color-swatches'); if (!showMoreButton || !colorSwatchesContainer) return; const shouldShow = window.innerWidth <= 480; showMoreButton.style.display = shouldShow ? 'block' : 'none'; colorSwatchesContainer.classList.toggle('collapsed', shouldShow); if (!showMoreButton.dataset.listenerAttached) { showMoreButton.addEventListener('click', function() { const isCollapsed = colorSwatchesContainer.classList.toggle('collapsed'); showMoreButton.textContent = isCollapsed ? 'Show More Colors' : 'Show Less Colors'; }); showMoreButton.dataset.listenerAttached = 'true'; } showMoreButton.textContent = colorSwatchesContainer.classList.contains('collapsed') ? 'Show More Colors' : 'Show Less Colors';
    }

    function updateMiniColorSwatch() {
        const pricingColorNameEl = document.getElementById('pricing-color-name'); const miniColorSwatchEl = document.getElementById('pricing-color-swatch'); const mainColorName = window.selectedColorName || document.getElementById('product-color-context')?.textContent || 'N/A'; if (!pricingColorNameEl || !miniColorSwatchEl) { console.warn("PricingPages: Mini swatch elements not found."); return; } console.log(`PricingPages: Updating mini swatch for color: ${mainColorName}`); pricingColorNameEl.textContent = mainColorName; const allSwatches = document.querySelectorAll('.color-swatch'); let matchedSwatch = null; for (const swatch of allSwatches) { const swatchName = swatch.dataset.colorName; const catalogColor = swatch.dataset.catalogColor; if ( (window.selectedCatalogColor && NWCAUtils.normalizeColorName(catalogColor) === NWCAUtils.normalizeColorName(window.selectedCatalogColor)) || (!window.selectedCatalogColor && NWCAUtils.normalizeColorName(swatchName) === NWCAUtils.normalizeColorName(mainColorName)) ) { matchedSwatch = swatch; break; } } miniColorSwatchEl.className = 'mini-color-swatch clickable'; miniColorSwatchEl.style.backgroundImage = ''; miniColorSwatchEl.style.backgroundColor = '#ccc'; if (matchedSwatch) { const computedStyle = window.getComputedStyle(matchedSwatch); miniColorSwatchEl.style.backgroundImage = computedStyle.backgroundImage; miniColorSwatchEl.style.backgroundColor = computedStyle.backgroundColor; miniColorSwatchEl.classList.add('active-swatch'); console.log("PricingPages: Applied style from matched swatch."); } else { miniColorSwatchEl.classList.add('fallback-swatch'); console.warn("PricingPages: No matching swatch found for mini swatch, using fallback style."); } if (!miniColorSwatchEl.dataset.listenerAttached) { miniColorSwatchEl.addEventListener('click', function() { const targetSwatch = Array.from(allSwatches).find(s => s.dataset.colorName === mainColorName || s.dataset.catalogColor === window.selectedCatalogColor ); if (targetSwatch) { targetSwatch.scrollIntoView({ behavior: 'smooth', block: 'center' }); targetSwatch.classList.add('pulse-highlight'); setTimeout(() => targetSwatch.classList.remove('pulse-highlight'), 2000); } }); miniColorSwatchEl.dataset.listenerAttached = 'true'; }
    }

    // Helper function to determine layout preference (grid vs matrix) based on container presence
    // Moved from add-to-cart.js to fix scope issue
    function determineLayoutPreference() {
        const gridContainer = document.getElementById('size-quantity-grid-container');
        const matrixContainer = document.getElementById('quantity-matrix');
        if (gridContainer && window.getComputedStyle(gridContainer).display !== 'none') return true; // Check if visible
        if (matrixContainer && window.getComputedStyle(matrixContainer).display !== 'none') return false; // Check if visible
        // Fallback if neither is explicitly visible (e.g., during initial load)
        if (gridContainer) return true; // Default to grid if element exists
        if (matrixContainer) return false; // Default to matrix if element exists
        console.warn('[PricingPageUI] Could not determine preferred layout container (grid/matrix). Defaulting to matrix layout.');
        return false; // Final fallback
    }


    // --- Main Initialization ---

    async function initPricingPage() {
        console.log("PricingPages: Initializing pricing page (v4)...");
        updateProductContext();
        updateTabNavigation();

        // Load dependent scripts sequentially
        try {
            await loadScript('/cart.js');
            await loadScript('/cart-integration.js');
            await loadScript('/pricing-matrix-capture.js');
            await loadScript('/pricing-calculator.js');
            await loadScript('/product-quantity-ui.js');
            await loadScript('/add-to-cart.js');
            await loadScript('/order-form-pdf.js'); // Load PDF script too
            console.log("PricingPages: Core scripts loaded sequentially.");
        } catch (error) {
            console.error('PricingPages: Critical error loading core scripts:', error);
            const body = document.querySelector('body');
            if (body) body.insertAdjacentHTML('afterbegin', '<div style="background-color:red;color:white;padding:10px;text-align:center;font-weight:bold;">Error loading essential page components. Please refresh.</div>');
            return; // Stop initialization if core scripts fail
        }

        // Setup UI elements
        setupTabs();
        setupImageZoom();
        handleMobileAdjustments();
        window.addEventListener('resize', handleMobileAdjustments);

        // Determine Caspio DP to load
        const styleNumber = window.selectedStyleNumber;
        const embType = getEmbellishmentTypeFromUrl();
        const pricingContainerId = CONTAINER_IDS[embType] || 'pricing-calculator';
        const appKeys = CASPIO_APP_KEYS[embType] || [];
        const pricingContainer = document.getElementById(pricingContainerId);

        if (!pricingContainer) { console.error(`PricingPages: Pricing container #${pricingContainerId} not found.`); return; }
        if (embType === 'unknown' || (embType !== 'dtf' && appKeys.length === 0)) { console.error(`PricingPages: Unknown page type or no AppKeys for ${embType}.`); displayContactMessage(pricingContainer, embType); return; }
        if (embType === 'dtf') { console.log("PricingPages: Handling DTF page (coming soon)."); displayContactMessage(pricingContainer, embType); initializeFallbackPricingData(embType); return; }

        // Try loading Caspio
        await tryLoadCaspioSequentially(pricingContainer, appKeys, styleNumber, embType);

        // Final UI setup
        setupInventoryLegend();
        updateMiniColorSwatch();

        console.log("PricingPages: Initialization sequence complete.");
    }

    // --- Fallback Mechanisms ---

    function initializeFallbackPricingData(embType) {
        if (window.nwcaPricingData) return; // Don't overwrite if data was somehow captured
        console.warn(`PricingPages: Initializing FALLBACK pricing data for ${embType}.`); let headers = ['S-XL', '2XL', '3XL']; let prices = { 'S-XL': { 'Tier1': 20.00, 'Tier2': 19.00, 'Tier3': 18.00, 'Tier4': 17.00 }, '2XL': { 'Tier1': 22.00, 'Tier2': 21.00, 'Tier3': 20.00, 'Tier4': 19.00 }, '3XL': { 'Tier1': 23.00, 'Tier2': 22.00, 'Tier3': 21.00, 'Tier4': 20.00 }, }; let tiers = { 'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11, LTM_Fee: 50 }, 'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23, LTM_Fee: 25 }, 'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 }, 'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }, }; let uniqueSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL']; if (embType === 'cap-embroidery') { headers = ['One Size']; prices = { 'One Size': { 'Tier1': 22.99, 'Tier2': 21.99, 'Tier3': 20.99, 'Tier4': 19.99 } }; uniqueSizes = ['OS']; } window.nwcaPricingData = { styleNumber: window.selectedStyleNumber || 'FALLBACK', color: window.selectedColorName || 'FALLBACK', embellishmentType: embType, headers: headers, prices: prices, tierData: tiers, uniqueSizes: uniqueSizes, capturedAt: new Date().toISOString(), isFallback: true }; window.availableSizesFromTable = headers; console.log('PricingPages: Fallback pricing global variables initialized.', window.nwcaPricingData); window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData }));
    }

    function displayContactMessage(container, embType) {
        if (!container) return; console.log(`PricingPages: Displaying contact message for ${embType} in #${container.id}`); container.innerHTML = ''; container.classList.remove('loading'); container.classList.add('pricing-unavailable'); ensureHiddenCartElements(container); const messageElement = document.createElement('div'); messageElement.style.textAlign = 'center'; messageElement.style.padding = '30px 20px'; messageElement.style.backgroundColor = '#f8f9fa'; messageElement.style.borderRadius = '8px'; messageElement.style.border = '1px solid #dee2e6'; messageElement.style.margin = '20px 0'; messageElement.innerHTML = `<h3 style="color: #0056b3; margin-bottom: 15px;">Pricing Currently Unavailable</h3><p style="font-size: 16px; color: #495057; margin-bottom: 20px;">We apologize, but the pricing details for this item are currently unavailable.</p><p style="font-size: 16px; color: #495057; margin-bottom: 20px;">Please call <strong style="color: #0056b3; font-size: 18px;">253-922-5793</strong> for an accurate quote.</p><p style="font-size: 14px; color: #6c757d;">Our team is ready to assist you.</p>`; container.appendChild(messageElement);
    }

    // --- Global UI Object ---
    window.PricingPageUI = {
        updatePriceDisplayForSize: updatePriceDisplayForSize,
        // updateCartInfoDisplay and updateTierInfoDisplay are removed as their functionality
        // is now integrated into product-pricing-ui.js (updateComprehensiveTierInfo)
        showSuccessNotification: showSuccessWithViewCartButton,
        handleMobileAdjustments: handleMobileAdjustments,
        updateMiniColorSwatch: updateMiniColorSwatch,
        determineLayoutPreference: determineLayoutPreference
    };


    // Dispatch event after UI object is assigned
    console.log("PricingPages: PricingPageUI object created.");
    window.dispatchEvent(new CustomEvent('pricingPageUIReady'));
    console.log("PricingPages: Dispatched 'pricingPageUIReady' event.");

    // --- Event Listeners ---
    document.addEventListener('DOMContentLoaded', initPricingPage);

    window.addEventListener('error', function(event) {
        console.error('PricingPages: Global error caught:', event.message, event.error);
    });

})(); // End of IIFE