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

    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

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
        console.log("[DEBUG] updateProductContext START");
        const styleNumber = getUrlParameter('StyleNumber');
        const colorFromUrl = getUrlParameter('COLOR');

        // --- DIAGNOSIS: Check for placeholder values ---
        if (styleNumber === '{styleNumber}' || colorFromUrl === '{colorCode}' || !styleNumber) { // Also check if styleNumber is missing
            console.error("PricingPages: ERROR - URL contains placeholder values or is missing style. Aborting initialization.", { styleNumber, colorFromUrl });
            // Display an error message to the user
            const errorMsg = (window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.MESSAGES && NWCA_APP_CONFIG.MESSAGES.INVALID_PRODUCT_LINK_ERROR) || '<strong>Error:</strong> Invalid product link parameters. Please go back to the product page, ensure a style and color are selected, wait a moment for links to update, and then try the pricing link again.';
            document.body.innerHTML = `<div class="error-message" style="padding: 20px; text-align: center; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 5px; margin: 20px;">${errorMsg}</div>`;
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
        console.log("[DEBUG] updateProductContext END");
    }

    // Fetches details for the initially selected color to display title, image etc.
    // Relies on dp5-helper.js to fetch and populate the actual color swatches.
    async function fetchProductDetails(styleNumber) {
        console.log("[DEBUG] fetchProductDetails START for style:", styleNumber);
        console.log(`[fetchProductDetails] Fetching product colors for Style: ${styleNumber} using /api/product-colors`);
        
        try {
            const apiUrl = `${window.API_BASE_URL || API_PROXY_BASE_URL}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`;
            console.log(`[fetchProductDetails] Fetching from: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log(`[fetchProductDetails] Received product colors data:`, await response.clone().json());
            
            const data = await response.json();
            
            if (!data || !data.colors || data.colors.length === 0) {
                console.error('[fetchProductDetails] No colors data received');
                return;
            }
            
            // Store all colors globally
            window.productColors = data.colors;
            
            // Get initial color from URL
            const urlColor = getUrlParameter('COLOR') ? decodeURIComponent(getUrlParameter('COLOR').replace(/\+/g, ' ')) : null;
            
            // Find the matching color
            let matchedColor = null;
            
            // Try exact match first
            matchedColor = data.colors.find(c =>
                c.CATALOG_COLOR && c.CATALOG_COLOR.toLowerCase() === urlColor?.toLowerCase()
            );
            
            // If no exact match, try partial match
            if (!matchedColor && urlColor) {
                matchedColor = data.colors.find(c =>
                    c.CATALOG_COLOR && c.CATALOG_COLOR.toLowerCase().includes(urlColor.toLowerCase())
                );
            }
            
            // If still no match, try COLOR_NAME
            if (!matchedColor && urlColor) {
                matchedColor = data.colors.find(c =>
                    c.COLOR_NAME && c.COLOR_NAME.toLowerCase().includes(urlColor.toLowerCase())
                );
            }
            
            // If still no match, use first color
            if (!matchedColor && data.colors.length > 0) {
                matchedColor = data.colors[0];
            }
            
            console.log(`[fetchProductDetails] Matched URL color "${urlColor}" to:`, matchedColor);
            
            if (matchedColor) {
                // Store the selected color globally
                window.selectedColorData = matchedColor;
                
                // Update global variables
                window.selectedColorName = matchedColor.COLOR_NAME || urlColor;
                window.selectedCatalogColor = matchedColor.CATALOG_COLOR || urlColor;
                
                // Store both for compatibility
                window.selectedColor = window.selectedColorName;
                window.catalogColor = window.selectedCatalogColor;
                
                console.log(`[fetchProductDetails] Globals Set: selectedColorName=${window.selectedColorName}, selectedCatalogColor=${window.selectedCatalogColor}`);
                
                // Update the product title
                const titleElContext = document.getElementById('product-title-context');
                const titleElOld = document.getElementById('product-title');
                const productTitle = data.productTitle || `Style ${styleNumber}`;
                
                if (titleElContext) titleElContext.textContent = productTitle;
                if (titleElOld) titleElOld.textContent = productTitle;
                
                // Update the style number
                const styleElContext = document.getElementById('product-style-context');
                const styleElOld = document.getElementById('product-style');
                if (styleElContext) styleElContext.textContent = styleNumber;
                if (styleElOld) styleElOld.textContent = styleNumber;
                
                // Update color display
                const colorElContext = document.getElementById('product-color-context');
                const colorElOld = document.getElementById('product-color');
                if (colorElContext) colorElContext.textContent = window.selectedColorName;
                if (colorElOld) colorElOld.textContent = window.selectedColorName;
                
                // Update the product images with gallery
                updateProductImageGallery(matchedColor);
                
                // Update mini color swatch
                updateMiniColorSwatch();
                
                // Populate color swatches
                populateColorSwatches(data.colors);
            }
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('productColorsReady', {
                detail: { colors: data.colors, selectedColor: matchedColor }
            }));
            
        } catch (error) {
            console.error('[fetchProductDetails] Error fetching product details:', error);
            const titleElContext = document.getElementById('product-title-context');
            const imageElContext = document.getElementById('product-image-context');
            if (titleElContext) titleElContext.textContent = 'Error Loading Product Info';
            if (imageElContext) imageElContext.src = '';
        }
        console.log("[DEBUG] fetchProductDetails END for style:", styleNumber);
    }

    // New function to update product image gallery with all available images
    function updateProductImageGallery(colorData) {
        console.log('[updateProductImageGallery] Updating image gallery with color data:', colorData);
        
        // Check if we have the new gallery structure
        const mainImageEl = document.getElementById('product-image-main');
        const mainImageContainer = document.getElementById('main-image-container');
        const thumbnailsContainer = document.getElementById('image-thumbnails');
        
        // Get the existing image element
        const existingImageEl = document.getElementById('product-image-context');
        
        // Add diagnostic logging
        console.log('[updateProductImageGallery] Element check:');
        console.log('  - mainImageEl (product-image-main):', mainImageEl);
        console.log('  - mainImageContainer:', mainImageContainer);
        console.log('  - thumbnailsContainer:', thumbnailsContainer);
        console.log('  - existingImageEl (product-image-context):', existingImageEl);
        
        if (!existingImageEl && !mainImageEl) {
            console.warn('[updateProductImageGallery] No image elements found - neither product-image-context nor product-image-main exist');
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
        if (colorData.MAIN_IMAGE_URL || colorData.FRONT_MODEL_IMAGE_URL) {
            images.push({
                url: colorData.MAIN_IMAGE_URL || colorData.FRONT_MODEL_IMAGE_URL,
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
        
        // If we have the new gallery elements
        if (mainImageEl && thumbnailsContainer) {
            console.log('[updateProductImageGallery] Using new gallery structure');
            
            // Set the main image
            if (images.length > 0) {
                mainImageEl.src = images[0].url;
                mainImageEl.alt = `${window.selectedStyleNumber || 'C112'} - ${window.selectedColorName || ''}`;
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
                
                // Setup zoom functionality
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
        } else if (existingImageEl) {
            console.log('[updateProductImageGallery] Fallback: Using existing image element (product-image-context)');
            // Use the existing image element
            if (images.length > 0) {
                existingImageEl.src = images[0].url;
                existingImageEl.alt = `${window.selectedStyleNumber || 'C112'} - ${window.selectedColorName || ''}`;
                console.log(`[updateProductImageGallery] Set existing image src to: ${images[0].url}`);
            } else {
                console.warn('[updateProductImageGallery] No images available for this color');
                existingImageEl.src = '';
                existingImageEl.alt = 'No image available';
            }
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
            if (color.COLOR_SQUARE_IMAGE) {
                swatch.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
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


    function handleColorSwatchClick(colorData) {
        console.log("[DEBUG] handleColorSwatchClick called with:", JSON.stringify(colorData, null, 2));
        if (!colorData || !colorData.COLOR_NAME) {
             console.error("[DEBUG] Invalid colorData passed to handleColorSwatchClick");
             return;
        }
        const newColorName = colorData.COLOR_NAME;
        const newCatalogColor = colorData.CATALOG_COLOR;
        console.log(`PricingPages: Color swatch clicked: ${newColorName} (Catalog: ${newCatalogColor})`);

        // --- Step 1: Update Global State ---
        window.selectedColorName = newColorName;
        window.selectedCatalogColor = newCatalogColor;
        window.selectedColorData = colorData; // Store full color data
        console.log(`[DEBUG] Globals updated: selectedColorName=${window.selectedColorName}, selectedCatalogColor=${window.selectedCatalogColor}`);

        // --- Step 2: Update UI Elements Immediately Available (Context and Fallback) ---
        const colorElContext = document.getElementById('product-color-context');
        const selectedColorSwatchContext = document.getElementById('selected-color-swatch-context');
        if (colorElContext) {
             colorElContext.textContent = newColorName;
             console.log(`[DEBUG] Updated #product-color-context text to: ${newColorName}`);
        } else {
             console.warn("[DEBUG] #product-color-context element not found.");
        }
        if (selectedColorSwatchContext) { // Update the context mini swatch
            const swatchImageUrl = colorData.COLOR_SQUARE_IMAGE;
            if (swatchImageUrl) {
                selectedColorSwatchContext.style.backgroundImage = `url('${swatchImageUrl}')`;
                selectedColorSwatchContext.style.backgroundColor = '';
            } else {
                selectedColorSwatchContext.style.backgroundImage = '';
                selectedColorSwatchContext.style.backgroundColor = NWCAUtils.normalizeColorName(newColorName || 'grey'); // Use NWCAUtils
            }
        }

        const colorElOld = document.getElementById('product-color'); // Fallback
        if (colorElOld) {
             colorElOld.textContent = newColorName;
        }

        const allSwatches = document.querySelectorAll('.color-swatch');
        console.log(`[DEBUG] Updating active class for ${allSwatches.length} swatches.`);
        allSwatches.forEach(s => {
            // Match primarily on CATALOG_COLOR if available, fallback to COLOR_NAME
            const sCatalogColor = s.dataset.catalogColor;
            const sColorName = s.dataset.colorName;
            const isActive = (newCatalogColor && sCatalogColor && NWCAUtils.normalizeColorName(sCatalogColor) === NWCAUtils.normalizeColorName(newCatalogColor)) ||
                             (!newCatalogColor && newColorName && sColorName && NWCAUtils.normalizeColorName(sColorName) === NWCAUtils.normalizeColorName(newColorName)); // Use NWCAUtils
            s.classList.toggle('active', isActive);
        });

        // --- Step 3: Update Product Image Gallery ---
        updateProductImageGallery(colorData);
        
        // --- Step 4: Update Mini Swatch ---
        updateMiniColorSwatch();

        // --- Step 5: Reload Caspio ---
        const styleNumber = window.selectedStyleNumber;
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

        // --- Step 6: Dispatch Event ---
        window.dispatchEvent(new CustomEvent('colorChanged', { detail: colorData }));
    }


    function updateTabNavigation() {
        console.log("PricingPages DEBUG: Entering updateTabNavigation()");
        const styleNumber = getUrlParameter('StyleNumber');
        const colorCode = getUrlParameter('COLOR');
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
        console.log("PricingPages DEBUG: Exiting updateTabNavigation()");
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
        screenprint: 'caspio-iframe-container', // Changed for screenprint direct iframe
        dtf: 'pricing-calculator'
    };
    
    // Modified to handle screenprint with direct iframe, others with /emb script
    function loadCaspioEmbed(containerId, caspioAppKey, styleNumber, embType) { // Added embType
        const container = document.getElementById(containerId);
        if (!container) { console.error(`PricingPages: Container #${containerId} not found.`); return; }
        if (!styleNumber) { console.error(`PricingPages: Style number missing for Caspio load.`); container.innerHTML = '<div class="error-message">Error: Style number missing.</div>'; container.dataset.loadFailed = 'true'; container.classList.add('pricing-unavailable'); return; }
        
        const colorForCaspio = window.selectedCatalogColor || window.selectedColorName || '';
        console.log(`PricingPages: Using color for Caspio: '${colorForCaspio}' for type: ${embType}, container: #${containerId}`);
        
        // Clear container and set loading message (unless it's the hidden screenprint iframe)
        if (embType !== 'screenprint') {
            container.innerHTML = '<div class="loading-message">Loading pricing data...</div>';
        } else {
            container.innerHTML = ''; // Clear previous iframe if any for screenprint
        }
        container.classList.add('loading');
        container.classList.remove('pricing-unavailable');
        delete container.dataset.loadFailed;
    
        const params = new URLSearchParams();
        params.append('StyleNumber', styleNumber);
        if (colorForCaspio) { params.append('COLOR', colorForCaspio); }
    
        if (embType === 'screenprint') {
            // For screenprint, load directly into an iframe with cbEmbed=1
            params.append('cbEmbed', '1'); // Crucial for postMessage
            // Ensure this is the correct direct Caspio DataPage URL, not the /emb script URL
            const directUrl = `https://c3eku948.caspio.com/dp/${caspioAppKey}?${params.toString()}`;
            console.log(`PricingPages: Loading Screenprint Caspio iframe directly from URL: ${directUrl}`);
            
            const iframe = document.createElement('iframe');
            iframe.src = directUrl;
            iframe.style.display = 'none'; // Keep it hidden as it's a data source
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.title = 'Caspio Data Source for Screen Print Pricing'; // Accessibility
            
            iframe.onload = function() {
                console.log(`PricingPages: Screenprint Caspio iframe ${caspioAppKey} loaded from ${directUrl}`);
                container.classList.remove('loading');
                // For direct iframe, postMessage should happen; timeout in adapter will handle if it doesn't.
                // No need for checkCaspioRender for this specific hidden iframe.
                container.dataset.loadFailed = 'false'; // Assume success if it loads, adapter handles data.
            };
            iframe.onerror = function() {
                console.error(`PricingPages: Error loading Screenprint Caspio iframe ${caspioAppKey} from ${directUrl}`);
                container.classList.remove('loading');
                container.classList.add('pricing-unavailable');
                container.dataset.loadFailed = 'true';
                // Trigger fallback UI via adapter's timeout or a specific event if needed
                // The adapter's timeout will handle showing the #pricing-fallback div.
                // We could also dispatch a specific error event here if needed.
                // document.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: `Failed to load screen print data source (iframe error).` }}));
            };
            container.appendChild(iframe);
    
        } else {
            // Original embed script method for other embellishment types
            const fullUrl = `https://c3eku948.caspio.com/dp/${caspioAppKey}/emb?${params.toString()}`;
            console.log(`PricingPages: Loading Caspio embed script from URL: ${fullUrl} for type ${embType}`);
            const scriptTag = document.createElement('script');
            scriptTag.type = 'text/javascript';
            scriptTag.src = fullUrl;
            scriptTag.async = true;
            scriptTag.onload = function() {
                console.log(`PricingPages: Caspio script ${caspioAppKey} loaded from ${fullUrl}`);
                container.classList.remove('loading');
                // Only call checkCaspioRender for non-screenprint types that use the visible embed
                setTimeout(() => checkCaspioRender(container, caspioAppKey), 5000);
            };
            scriptTag.onerror = function() {
                console.error(`PricingPages: Error loading Caspio script ${caspioAppKey} from ${fullUrl}`);
                container.classList.remove('loading');
                container.classList.add('pricing-unavailable');
                container.dataset.loadFailed = 'true';
            };
            container.appendChild(scriptTag);
        }
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
            loadCaspioEmbed(container.id, currentKey, styleNumber, embType); // Pass embType
            
            // For screenprint with direct iframe, we don't rely on checkCaspioRender in the same way.
            // The adapter's timeout is the main check for postMessage.
            // For others, keep the delay and check.
            if (embType !== 'screenprint') {
                await new Promise(resolve => setTimeout(resolve, 6000));
            } else {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Shorter wait for iframe, adapter handles timeout
            }
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

    function updatePriceDisplayForSize(size, quantity, unitPrice, displayPrice, itemTotal, ltmFeeApplies, ltmFeePerItem, combinedQuantity, ltmFee) {
        // Check if back logo is enabled for cap embroidery
        const hasBackLogo = window.CapEmbroideryBackLogo?.isEnabled() || false;
        const backLogoPerItem = window.CapEmbroideryBackLogo?.getPricePerItem() || 0;
        
        console.log(`[updatePriceDisplayForSize] Size: ${size}, hasBackLogo: ${hasBackLogo}, backLogoPerItem: ${backLogoPerItem}`);
        
        const matrixPriceDisplay = document.querySelector(`#quantity-matrix .price-display[data-size="${size}"]`);
        if (matrixPriceDisplay) {
            matrixPriceDisplay.dataset.unitPrice = unitPrice.toFixed(2);
            if (quantity <= 0) {
                matrixPriceDisplay.innerHTML = `$${unitPrice.toFixed(2)}`;
                matrixPriceDisplay.className = 'price-display'; // Reset classes
                matrixPriceDisplay.style.backgroundColor = '';
                matrixPriceDisplay.style.padding = '';
                matrixPriceDisplay.style.border = '';
            } else {
                let cardHtml = '';
                if (ltmFeeApplies) {
                    cardHtml = `
                        <div class="price-breakdown-card ltm-active">
                            <div class="price-breakdown-header">LTM Fee Applied</div>
                            <div class="price-breakdown-row"><span>Base:</span> <span>$${unitPrice.toFixed(2)}</span></div>`;
                    
                    // Add back logo row if enabled
                    if (hasBackLogo && backLogoPerItem > 0) {
                        cardHtml += `<div class="price-breakdown-row"><span>Back Logo:</span> <span>+$${backLogoPerItem.toFixed(2)}</span></div>`;
                    }
                    
                    cardHtml += `
                            <div class="price-breakdown-row"><span>LTM:</span> <span>+$${ltmFeePerItem.toFixed(2)}</span></div>
                            <div class="price-breakdown-row unit-price"><span>Unit:</span> <span>$${displayPrice.toFixed(2)}</span></div>
                            <div class="price-breakdown-row total-price"><span>Total (${quantity}):</span> <span>$${itemTotal.toFixed(2)}</span></div>
                        </div>`;
                } else {
                    cardHtml = `
                        <div class="price-breakdown-card standard">
                            <div class="price-breakdown-header">Standard Price</div>
                            <div class="price-breakdown-row unit-price"><span>Unit:</span> <span>$${unitPrice.toFixed(2)}</span></div>`;
                    
                    // Add back logo row if enabled
                    if (hasBackLogo && backLogoPerItem > 0) {
                        cardHtml += `<div class="price-breakdown-row"><span>Back Logo:</span> <span>+$${backLogoPerItem.toFixed(2)}</span></div>`;
                    }
                    
                    cardHtml += `
                            <div class="price-breakdown-row total-price"><span>Total (${quantity}):</span> <span>$${itemTotal.toFixed(2)}</span></div>
                        </div>`;
                }
                matrixPriceDisplay.innerHTML = cardHtml;
                matrixPriceDisplay.className = 'price-display has-breakdown'; // Add class to indicate it has the card
                matrixPriceDisplay.style.backgroundColor = '';
                matrixPriceDisplay.style.padding = '0';
                matrixPriceDisplay.style.border = 'none';
            }
            matrixPriceDisplay.dataset.quantity = quantity;
            matrixPriceDisplay.dataset.displayPrice = displayPrice;
            matrixPriceDisplay.dataset.tier = window.cartItemData?.tierKey || '';
        }
        const gridPriceDisplay = document.querySelector(`#size-quantity-grid-container .size-price[data-size="${size}"]`);
        if (gridPriceDisplay) {
            if (quantity <= 0) {
                gridPriceDisplay.textContent = `$${unitPrice.toFixed(2)}`;
                gridPriceDisplay.style.backgroundColor = '';
                gridPriceDisplay.style.padding = '';
                gridPriceDisplay.style.borderRadius = '';
                gridPriceDisplay.style.border = '';
                gridPriceDisplay.style.boxShadow = '';
                gridPriceDisplay.style.fontWeight = '';
                gridPriceDisplay.style.color = '';
            } else {
                // Build the price display HTML
                let priceHTML = '';
                
                if (ltmFeeApplies) {
                    priceHTML = `<div style="font-weight:bold;color:#212529;background-color:#ffc107;margin-bottom:5px;padding:3px;border-radius:4px;text-align:center;">⚠️ LTM FEE ⚠️</div>`;
                    priceHTML += `<div>$${unitPrice.toFixed(2)}`;
                    
                    // Add back logo if enabled
                    if (hasBackLogo && backLogoPerItem > 0) {
                        priceHTML += ` + <strong style="color:#0056b3">$${backLogoPerItem.toFixed(2)}</strong> BL`;
                    }
                    
                    priceHTML += ` + <strong style="color:#663c00">$${ltmFeePerItem.toFixed(2)}</strong> LTM</div>`;
                    priceHTML += `<div><strong style="font-size:1.1em;">$${itemTotal.toFixed(2)}</strong></div>`;
                    priceHTML += `<div style="background-color:#fff3cd;padding:3px;margin-top:3px;border-radius:3px;"><small>($${ltmFee.toFixed(2)} fee ÷ ${combinedQuantity} items)</small></div>`;
                    
                    gridPriceDisplay.innerHTML = priceHTML;
                    gridPriceDisplay.style.backgroundColor = '#fff3cd';
                    gridPriceDisplay.style.padding = '8px';
                    gridPriceDisplay.style.borderRadius = '4px';
                    gridPriceDisplay.style.border = '2px solid #dc3545';
                    gridPriceDisplay.style.boxShadow = '0 0 5px rgba(220, 53, 69, 0.3)';
                } else {
                    // For non-LTM items, show back logo if enabled
                    if (hasBackLogo && backLogoPerItem > 0) {
                        priceHTML = `<div style="font-size:0.85em;color:#666;">Base: $${unitPrice.toFixed(2)}</div>`;
                        priceHTML += `<div style="font-size:0.85em;color:#0056b3;">+BL: $${backLogoPerItem.toFixed(2)}</div>`;
                        priceHTML += `<div style="font-weight:bold;font-size:1.1em;margin-top:2px;">$${displayPrice.toFixed(2)}</div>`;
                        
                        gridPriceDisplay.innerHTML = priceHTML;
                        gridPriceDisplay.style.backgroundColor = '#e8f5e9';
                        gridPriceDisplay.style.padding = '4px 8px';
                        gridPriceDisplay.style.borderRadius = '4px';
                        gridPriceDisplay.style.border = '1px solid #4caf50';
                        gridPriceDisplay.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        gridPriceDisplay.style.fontWeight = 'normal';
                        gridPriceDisplay.style.color = '#2e7d32';
                    } else {
                        gridPriceDisplay.textContent = `$${displayPrice.toFixed(2)}`;
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
            gridPriceDisplay.dataset.displayPrice = displayPrice;
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
        console.log("PricingPages DEBUG: Entering setupTabs()");
        const tabHeaders = document.querySelectorAll('.tab-header'); const tabPanes = document.querySelectorAll('.tab-pane'); if (!tabHeaders.length || !tabPanes.length) { console.log("PricingPages DEBUG: setupTabs - no tabs/panes found, returning."); return; } tabHeaders.forEach(header => { header.addEventListener('click', function() { tabHeaders.forEach(h => h.classList.remove('active')); tabPanes.forEach(p => p.classList.remove('active')); this.classList.add('active'); const tabId = this.getAttribute('data-tab'); const targetPane = document.getElementById(tabId); if (targetPane) targetPane.classList.add('active'); }); }); console.log("PricingPages: Tab functionality initialized.");
        console.log("PricingPages DEBUG: Exiting setupTabs()");
    }

    function setupInventoryLegend() {
        const hasLowInventory = window.inventoryData && window.inventoryData.sizeTotals && window.inventoryData.sizeTotals.some(qty => qty > 0 && qty < 10); const legend = document.querySelector('.inventory-indicator-legend'); if (legend) { legend.style.display = hasLowInventory ? 'block' : 'none'; console.log(`PricingPages: Inventory legend display set to ${hasLowInventory ? 'block' : 'none'}.`); }
    }

    function setupImageZoom() {
        console.log("PricingPages DEBUG: Entering setupImageZoom()");
        // The new gallery has its own zoom functionality, so we just need to ensure it's set up
        // This function is called during initialization, but the actual zoom is handled by setupImageZoomForGallery
        console.log("PricingPages: Image zoom will be handled by the gallery.");
        console.log("PricingPages DEBUG: Exiting setupImageZoom()");
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

    function updateEmbroideryDefaultStitchInfo() {
        const stitchInfoElement = document.getElementById('embroidery-default-stitch-info');
        if (stitchInfoElement && window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.PRODUCT_DEFAULTS && typeof NWCA_APP_CONFIG.PRODUCT_DEFAULTS.DEFAULT_EMBROIDERY_STITCH_COUNT !== 'undefined') {
            const defaultStitches = NWCA_APP_CONFIG.PRODUCT_DEFAULTS.DEFAULT_EMBROIDERY_STITCH_COUNT;
            stitchInfoElement.textContent = `Pricing Includes a ${defaultStitches.toLocaleString()} stitch embroidered logo.`;
            console.log(`PricingPages: Updated embroidery default stitch info to ${defaultStitches} stitches.`);
        } else {
            if (!stitchInfoElement) console.log("PricingPages: Embroidery stitch info element not found.");
            if (!window.NWCA_APP_CONFIG || !NWCA_APP_CONFIG.PRODUCT_DEFAULTS || typeof NWCA_APP_CONFIG.PRODUCT_DEFAULTS.DEFAULT_EMBROIDERY_STITCH_COUNT === 'undefined') {
                console.log("PricingPages: Default embroidery stitch count config not found.");
            }
        }
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
        
        console.log(`PricingPages DOM CHECK --- STEP 1: embType determined as '${embType}'`);

        if (embType === 'screenprint') {
            console.log(`PricingPages DOM CHECK --- STEP 2: embType is 'screenprint'. Attempting to find #caspio-iframe-container.`);
            const containerForScreenprint = document.getElementById('caspio-iframe-container');
            if (containerForScreenprint) {
                console.log(`PricingPages DOM CHECK --- STEP 3: #caspio-iframe-container FOUND!`);
                // Now proceed with screenprint specific loading using this container
                const appKeys = CASPIO_APP_KEYS['screenprint'] || [];
                if (appKeys.length > 0) {
                    console.log(`PricingPages DOM CHECK --- STEP 4: AppKeys for screenprint found. Proceeding to load.`);
                    await tryLoadCaspioSequentially(containerForScreenprint, appKeys, styleNumber, 'screenprint');
                } else {
                    console.error(`PricingPages DOM CHECK --- STEP 4: No AppKeys for screenprint!`);
                    displayContactMessage(document.getElementById('pricing-fallback') || document.body, 'screenprint');
                    initializeFallbackPricingData('screenprint');
                }
            } else {
                console.error(`PricingPages DOM CHECK --- STEP 3: #caspio-iframe-container NOT FOUND via getElementById! This is the critical issue.`);
                if (document.documentElement) {
                    const fullHTML = document.documentElement.outerHTML;
                    if (fullHTML.includes('id="caspio-iframe-container"')) {
                        console.warn("PricingPages DOM CHECK (fail detail): The string 'id=\"caspio-iframe-container\"' IS PRESENT in document.documentElement.outerHTML. This suggests getElementById is failing for an unexpected reason.");
                    } else {
                        console.error("PricingPages DOM CHECK (fail detail): The string 'id=\"caspio-iframe-container\"' IS NOT PRESENT in document.documentElement.outerHTML. The div is missing from the DOM string.");
                    }
                } else {
                    console.error(`PricingPages DOM CHECK (fail detail): document.documentElement is NULL or undefined!`);
                }
                displayContactMessage(document.getElementById('pricing-fallback') || document.body, 'screenprint');
                initializeFallbackPricingData('screenprint');
                return; // Stop further processing for screenprint if container not found
            }
        } else {
            // Original logic for other embellishment types
            console.log(`PricingPages DOM CHECK --- STEP 2: embType is '${embType}' (not screenprint). Using original logic.`);
            const pricingContainerId = CONTAINER_IDS[embType] || 'pricing-calculator';
            const appKeys = CASPIO_APP_KEYS[embType] || [];
            const pricingContainer = document.getElementById(pricingContainerId);

            if (!pricingContainer) {
                console.error(`PricingPages: Pricing container #${pricingContainerId} not found for ${embType}.`);
                displayContactMessage(document.getElementById('pricing-fallback') || document.body, embType);
                initializeFallbackPricingData(embType);
                return;
            }
            if (embType === 'unknown' || (embType !== 'dtf' && appKeys.length === 0)) {
                console.error(`PricingPages: Unknown page type or no AppKeys for ${embType}.`);
                displayContactMessage(pricingContainer, embType);
                initializeFallbackPricingData(embType);
                return;
            }
            if (embType === 'dtf') {
                console.log("PricingPages: Handling DTF page (coming soon).");
                displayContactMessage(pricingContainer, embType);
                initializeFallbackPricingData(embType);
                return;
            }
            await tryLoadCaspioSequentially(pricingContainer, appKeys, styleNumber, embType);
        }
        // Final UI setup
        setupInventoryLegend();
        updateMiniColorSwatch();
        updateEmbroideryDefaultStitchInfo(); // Update embroidery specific info

        console.log("PricingPages: Initialization sequence complete.");
    }

    // --- Fallback Mechanisms ---

    function initializeFallbackPricingData(embType) {
        if (window.nwcaPricingData) return; // Don't overwrite if data was somehow captured
        console.warn(`PricingPages: Initializing FALLBACK pricing data for ${embType}.`); let headers = ['S-XL', '2XL', '3XL']; let prices = { 'S-XL': { 'Tier1': 20.00, 'Tier2': 19.00, 'Tier3': 18.00, 'Tier4': 17.00 }, '2XL': { 'Tier1': 22.00, 'Tier2': 21.00, 'Tier3': 20.00, 'Tier4': 19.00 }, '3XL': { 'Tier1': 23.00, 'Tier2': 22.00, 'Tier3': 21.00, 'Tier4': 20.00 }, }; let tiers = { 'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11, LTM_Fee: 50 }, 'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23, LTM_Fee: 25 }, 'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 }, 'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }, }; let uniqueSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL']; if (embType === 'cap-embroidery') { headers = ['One Size']; prices = { 'One Size': { 'Tier1': 22.99, 'Tier2': 21.99, 'Tier3': 20.99, 'Tier4': 19.99 } }; uniqueSizes = ['OS']; } window.nwcaPricingData = { styleNumber: window.selectedStyleNumber || 'FALLBACK', color: window.selectedColorName || 'FALLBACK', embellishmentType: embType, headers: headers, prices: prices, tierData: tiers, uniqueSizes: uniqueSizes, capturedAt: new Date().toISOString(), isFallback: true }; window.availableSizesFromTable = headers; console.log('PricingPages: Fallback pricing global variables initialized.', window.nwcaPricingData); window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData }));
    }

    function displayContactMessage(container, embType) {
        if (!container) return; console.log(`PricingPages: Displaying contact message for ${embType} in #${container.id}`); container.innerHTML = ''; container.classList.remove('loading'); container.classList.add('pricing-unavailable'); ensureHiddenCartElements(container); const messageElement = document.createElement('div'); messageElement.style.textAlign = 'center'; messageElement.style.padding = '30px 20px'; messageElement.style.backgroundColor = '#f8f9fa'; messageElement.style.borderRadius = '8px'; messageElement.style.border = '1px solid #dee2e6'; messageElement.style.margin = '20px 0';
        const phoneNumber = (window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.MESSAGES && NWCA_APP_CONFIG.MESSAGES.CONTACT_PHONE_NUMBER) || "253-922-5793";
        const headerMsg = (window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.MESSAGES && NWCA_APP_CONFIG.MESSAGES.PRICING_UNAVAILABLE_HEADER) || "Pricing Currently Unavailable";
        const body1Msg = (window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.MESSAGES && NWCA_APP_CONFIG.MESSAGES.PRICING_UNAVAILABLE_BODY_1) || "We apologize, but the pricing details for this item are currently unavailable.";
        const callInstructionMsg = ((window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.MESSAGES && NWCA_APP_CONFIG.MESSAGES.PRICING_UNAVAILABLE_CALL_INSTRUCTION) || "Please call <strong style=\"color: #0056b3; font-size: 18px;\">%PHONE_NUMBER%</strong> for an accurate quote.").replace("%PHONE_NUMBER%", phoneNumber);
        const assistanceMsg = (window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.MESSAGES && NWCA_APP_CONFIG.MESSAGES.PRICING_UNAVAILABLE_ASSISTANCE) || "Our team is ready to assist you.";
        messageElement.innerHTML = `<h3 style="color: #0056b3; margin-bottom: 15px;">${headerMsg}</h3><p style="font-size: 16px; color: #495057; margin-bottom: 20px;">${body1Msg}</p><p style="font-size: 16px; color: #495057; margin-bottom: 20px;">${callInstructionMsg}</p><p style="font-size: 14px; color: #6c757d;">${assistanceMsg}</p>`; container.appendChild(messageElement);
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