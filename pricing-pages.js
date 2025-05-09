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
        const styleNumber = getUrlParameter('StyleNumber');
        const colorFromUrl = getUrlParameter('COLOR');

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
        console.log(`[fetchProductDetails] Fetching initial details for Style: ${styleNumber}`);

        // Get initial color from URL - DO NOT set globals here yet, wait for API confirmation
        const initialUrlColorName = getUrlParameter('COLOR') ? decodeURIComponent(getUrlParameter('COLOR').replace(/\+/g, ' ')) : null;
        console.log(`[fetchProductDetails] Initial color from URL: ${initialUrlColorName}`);

        // Use the URL color if present, otherwise fetch without color to get defaults/first color info
        const colorIdentifierForApi = initialUrlColorName; // Can be null

        try {
            // --- Step 1: Fetch details for the specific initial color (or default if none specified) ---
            let detailApiUrl = `${API_PROXY_BASE_URL}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`;
            if (colorIdentifierForApi) {
                detailApiUrl += `&color=${encodeURIComponent(colorIdentifierForApi)}`;
            }
            console.log(`[fetchProductDetails] Fetching initial details from: ${detailApiUrl}`);
            const response = await fetch(detailApiUrl);
            if (!response.ok) throw new Error(`API Error (Initial Details): ${response.status}`);
            const details = await response.json();
            console.log("[fetchProductDetails] Received initial details:", JSON.stringify(details, null, 2));

            // --- Step 2: Update Global State with confirmed initial color ---
            window.selectedColorName = details.COLOR_NAME || initialUrlColorName || null;
            window.selectedCatalogColor = details.CATALOG_COLOR || null;
            console.log(`[fetchProductDetails] Initial Globals Set: selectedColorName=${window.selectedColorName}, selectedCatalogColor=${window.selectedCatalogColor}`);

            // --- Step 3: Update Initial UI Elements (New Context and Old Fallback) ---
            const titleElContext = document.getElementById('product-title-context');
            const imageElContext = document.getElementById('product-image-context');
            const colorElContext = document.getElementById('product-color-context');
            const selectedColorSwatchContext = document.getElementById('selected-color-swatch-context');

            const titleElOld = document.getElementById('product-title'); // Fallback
            const imageElOld = document.getElementById('product-image'); // Fallback
            const colorElOld = document.getElementById('product-color'); // Fallback

            const productTitleText = details.PRODUCT_TITLE || styleNumber;
            if (titleElContext) titleElContext.textContent = productTitleText;
            if (titleElOld) titleElOld.textContent = productTitleText;


            const initialImageUrl = details.MAIN_IMAGE_URL || details.FRONT_MODEL || details.FRONT_FLAT || '';
            if (initialImageUrl) {
                if (imageElContext) {
                    imageElContext.src = initialImageUrl;
                    imageElContext.alt = `${productTitleText} - ${window.selectedColorName || ''}`;
                    console.log(`[fetchProductDetails] Set initial context image src to: ${initialImageUrl}`);
                }
                if (imageElOld) { // Fallback
                    imageElOld.src = initialImageUrl;
                    imageElOld.alt = `${productTitleText} - ${window.selectedColorName || ''}`;
                }
            } else {
                if (imageElContext) { imageElContext.src = ''; imageElContext.alt = productTitleText; }
                if (imageElOld) { imageElOld.src = ''; imageElOld.alt = productTitleText; }
                console.warn("[fetchProductDetails] No initial image URL found in API response.");
            }

            const colorNameText = window.selectedColorName || 'Not Selected';
            if (colorElContext) colorElContext.textContent = colorNameText;
            if (colorElOld) colorElOld.textContent = colorNameText;
            
            if (selectedColorSwatchContext) { // Update the context mini swatch
                const swatchImageUrl = details.COLOR_SWATCH_IMAGE_URL;
                if (swatchImageUrl) {
                    selectedColorSwatchContext.style.backgroundImage = `url('${swatchImageUrl}')`;
                    selectedColorSwatchContext.style.backgroundColor = ''; // Clear background color if image is used
                } else {
                    selectedColorSwatchContext.style.backgroundImage = '';
                    selectedColorSwatchContext.style.backgroundColor = NWCAUtils.normalizeColorName(window.selectedColorName || 'grey'); // Use NWCAUtils
                }
            }


            // --- Step 4: Update Mini Swatch in pricing section & Active Swatch ---
            setTimeout(() => {
                 updateMiniColorSwatch(); // This updates the #pricing-color-swatch in the right column
                 const allSwatches = document.querySelectorAll('.color-swatch');
                 allSwatches.forEach(s => {
                      const isActive = (window.selectedCatalogColor && NWCAUtils.normalizeColorName(s.dataset.catalogColor) === NWCAUtils.normalizeColorName(window.selectedCatalogColor)) ||
                                       (!window.selectedCatalogColor && window.selectedColorName && NWCAUtils.normalizeColorName(s.dataset.colorName) === NWCAUtils.normalizeColorName(window.selectedColorName)); // Use NWCAUtils
                      s.classList.toggle('active', isActive);
                 });
                 console.log("[fetchProductDetails] Applied initial active class to swatches.");
            }, 500);

            // --- Step 5: Swatch Population is handled by dp5-helper.js ---
            console.log("[fetchProductDetails] Swatch population will be handled by dp5-helper.js");

        } catch (error) {
            console.error('[fetchProductDetails] Error fetching initial product details:', error);
            const titleElContext = document.getElementById('product-title-context');
            const imageElContext = document.getElementById('product-image-context');
            if (titleElContext) titleElContext.textContent = 'Error Loading Product Info';
            if (imageElContext) imageElContext.src = '';
            const titleElOld = document.getElementById('product-title'); // Fallback
            const imageElOld = document.getElementById('product-image'); // Fallback
            if (titleElOld) titleElOld.textContent = 'Error Loading Product Info';
            if (imageElOld) imageElOld.src = '';
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
            const swatchImageUrl = colorData.COLOR_SWATCH_IMAGE_URL;
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

        // --- Step 3: Fetch Specific Details for Image & Update Mini Swatch ---
        const styleNumber = window.selectedStyleNumber;
        // Use CATALOG_COLOR if available for the API call, otherwise use COLOR_NAME
        const colorIdentifierForApi = newCatalogColor || newColorName;
        fetchAndApplyColorSpecificDetails(styleNumber, colorIdentifierForApi); // Will call updateMainProductImage and updateMiniColorSwatch internally

        // --- Step 4: Reload Caspio ---
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

    function updateTabNavigation() {
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

    function updatePriceDisplayForSize(size, quantity, unitPrice, displayPrice, itemTotal, ltmFeeApplies, ltmFeePerItem, combinedQuantity, ltmFee) {
        const matrixPriceDisplay = document.querySelector(`#quantity-matrix .price-display[data-size="${size}"]`); if (matrixPriceDisplay) { matrixPriceDisplay.dataset.unitPrice = unitPrice.toFixed(2); if (quantity <= 0) { matrixPriceDisplay.innerHTML = `$${unitPrice.toFixed(2)}`; matrixPriceDisplay.style.backgroundColor = ''; matrixPriceDisplay.style.padding = ''; matrixPriceDisplay.style.border = ''; } else { if (ltmFeeApplies) { matrixPriceDisplay.innerHTML = `<div class="price-card" style="font-size:0.9em;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-radius:4px;overflow:hidden;max-width:100%;"><div style="background-color:#ffc107;color:#212529;font-weight:bold;padding:3px 0;text-align:center;font-size:0.8em;">⚠️ LTM FEE</div><div style="padding:4px;background-color:#fff3cd;"><div style="display:flex;justify-content:space-between;font-size:0.85em;"><span>Base:</span><span>$${unitPrice.toFixed(2)}</span></div><div style="display:flex;justify-content:space-between;color:#dc3545;font-weight:bold;font-size:0.85em;"><span>LTM:</span><span>+$${ltmFeePerItem.toFixed(2)}</span></div><div style="display:flex;justify-content:space-between;border-top:1px dashed #ffc107;padding-top:2px;font-weight:bold;"><span>Unit:</span><span>$${displayPrice.toFixed(2)}</span></div><div style="text-align:center;background-color:#f8f9fa;margin-top:3px;padding:2px;border-radius:3px;font-weight:bold;">$${itemTotal.toFixed(2)} total (${quantity})</div></div></div>`; matrixPriceDisplay.style.backgroundColor = ''; matrixPriceDisplay.style.padding = '0'; matrixPriceDisplay.style.border = 'none'; } else { matrixPriceDisplay.innerHTML = `<div class="price-card" style="font-size:0.9em;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-radius:4px;overflow:hidden;max-width:100%;"><div style="background-color:#0056b3;color:white;font-weight:bold;padding:3px 0;text-align:center;font-size:0.8em;">STANDARD</div><div style="padding:4px;background-color:#f8f9fa;"><div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Unit:</span><span>$${unitPrice.toFixed(2)}</span></div><div style="text-align:center;background-color:#e6f7ff;margin-top:3px;padding:2px;border-radius:3px;font-weight:bold;">$${itemTotal.toFixed(2)} total (${quantity})</div></div></div>`; matrixPriceDisplay.style.backgroundColor = ''; matrixPriceDisplay.style.padding = '0'; matrixPriceDisplay.style.border = 'none'; } } matrixPriceDisplay.dataset.quantity = quantity; matrixPriceDisplay.dataset.displayPrice = displayPrice; matrixPriceDisplay.dataset.tier = window.cartItemData?.tierKey || ''; }
        const gridPriceDisplay = document.querySelector(`#size-quantity-grid-container .size-price[data-size="${size}"]`); if (gridPriceDisplay) { if (quantity <= 0) { gridPriceDisplay.textContent = `$${unitPrice.toFixed(2)}`; gridPriceDisplay.style.backgroundColor = ''; gridPriceDisplay.style.padding = ''; gridPriceDisplay.style.borderRadius = ''; gridPriceDisplay.style.border = ''; gridPriceDisplay.style.boxShadow = ''; } else { if (ltmFeeApplies) { gridPriceDisplay.innerHTML = `<div style="font-weight:bold;color:#212529;background-color:#ffc107;margin-bottom:5px;padding:3px;border-radius:4px;text-align:center;">⚠️ LTM FEE ⚠️</div><div>$${unitPrice.toFixed(2)} + <strong style="color:#663c00">$${ltmFeePerItem.toFixed(2)}</strong> LTM</div><div><strong style="font-size:1.1em;">$${itemTotal.toFixed(2)}</strong></div><div style="background-color:#fff3cd;padding:3px;margin-top:3px;border-radius:3px;"><small>($${ltmFee.toFixed(2)} fee ÷ ${combinedQuantity} items)</small></div>`; gridPriceDisplay.style.backgroundColor = '#fff3cd'; gridPriceDisplay.style.padding = '8px'; gridPriceDisplay.style.borderRadius = '4px'; gridPriceDisplay.style.border = '2px solid #dc3545'; gridPriceDisplay.style.boxShadow = '0 0 5px rgba(220, 53, 69, 0.3)'; } else { gridPriceDisplay.textContent = `$${displayPrice.toFixed(2)}`; gridPriceDisplay.style.backgroundColor = ''; gridPriceDisplay.style.padding = ''; gridPriceDisplay.style.borderRadius = ''; gridPriceDisplay.style.border = ''; gridPriceDisplay.style.boxShadow = ''; } } gridPriceDisplay.dataset.quantity = quantity; gridPriceDisplay.dataset.unitPrice = unitPrice; gridPriceDisplay.dataset.displayPrice = displayPrice; gridPriceDisplay.dataset.tier = window.cartItemData?.tierKey || ''; }
    }

    function updateCartInfoDisplay(newQuantity, combinedQuantity, currentTierKey) {
        const cartInfoDisplay = document.getElementById('cart-info-display');
        const cartContentsInfo = document.getElementById('cart-contents-info');
        // Get cart quantity from global state
        const cartQuantity = window.cartItemData?.cartQuantity || 0;
        
        if (cartInfoDisplay) {
            if (newQuantity > 0) {
                let infoHtml = `<div id="adding-info">Adding <strong><span id="new-items-count">${newQuantity}</span></strong> item(s).</div>`;
                
                // Add prospective calculation info if there are items in cart
                if (cartQuantity > 0) {
                    infoHtml += `
                    <div id="prospective-calculation" style="margin-top: 10px; background-color: #e8f4ff; padding: 8px; border-radius: 5px; border-left: 3px solid #0d6efd;">
                        <div style="font-weight: bold; margin-bottom: 5px;">📊 Prospective Pricing Calculation:</div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Items being added:</span>
                            <span><strong>${newQuantity}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Items already in cart:</span>
                            <span><strong>${cartQuantity}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 1px dashed #0d6efd; margin-top: 5px; padding-top: 5px;">
                            <span>Combined total for pricing:</span>
                            <span><strong id="combined-items-count">${combinedQuantity}</strong></span>
                        </div>
                    </div>`;
                } else {
                    infoHtml += `<div id="combined-total" style="margin-top: 5px;">Combined total for pricing: <strong><span id="combined-items-count">${combinedQuantity}</span></strong> item(s).</div>`;
                }
                
                infoHtml += `<div id="current-tier" style="margin-top: 5px;">Current Pricing Tier: <strong><span id="tier-name">${currentTierKey || 'N/A'}</span></strong></div>`;
                
                // Show LTM threshold info if applicable
                if (combinedQuantity < 24) {
                    const itemsNeededForNoLTM = 24 - combinedQuantity;
                    infoHtml += `
                    <div id="ltm-threshold-info" style="margin-top: 8px; background-color: #fff3cd; padding: 8px; border-radius: 5px; font-size: 0.9em;">
                        <span style="font-weight: bold;">⚠️ LTM Fee Applied:</span> Add ${itemsNeededForNoLTM} more item(s) to reach the 24-item threshold and eliminate the LTM fee.
                    </div>`;
                }
                
                cartInfoDisplay.innerHTML = infoHtml;
                cartInfoDisplay.style.display = 'block';
            } else {
                cartInfoDisplay.innerHTML = '';
                cartInfoDisplay.style.display = 'none';
            }
        }
        
        if (cartContentsInfo) {
            if (newQuantity > 0) {
                let summaryHtml = '<strong>Items to Add:</strong><ul>';
                const sizeQuantities = window.cartItemData?.items || {};
                Object.entries(sizeQuantities).forEach(([size, item]) => {
                    if (item.quantity > 0) {
                        summaryHtml += `<li>${size}: ${item.quantity} @ $${item.displayUnitPrice.toFixed(2)}</li>`;
                    }
                });
                summaryHtml += '</ul>';
                
                // Add cart contents info if there are items in cart
                if (cartQuantity > 0) {
                    const embType = getEmbellishmentTypeFromUrl();
                    summaryHtml += `
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #dee2e6;">
                        <strong>Already in Cart:</strong> ${cartQuantity} ${embType.replace('-', ' ')} items
                    </div>`;
                }
                
                cartContentsInfo.innerHTML = summaryHtml;
                cartContentsInfo.style.display = 'block';
            } else {
                cartContentsInfo.innerHTML = '';
                cartContentsInfo.style.display = 'none';
            }
        }
    }

    function updateTierInfoDisplay(tierKey, nextTier, quantityForNextTier, combinedQuantity) {
        let tierInfoContainer = document.getElementById('tier-info-display');
        
        try {
            if (!tierInfoContainer) {
                tierInfoContainer = document.createElement('div');
                tierInfoContainer.id = 'tier-info-display';
                tierInfoContainer.className = 'tier-info-display pricing-tier-info';
                const cartSummary = document.querySelector('.cart-summary');
                if (cartSummary?.parentNode) {
                    cartSummary.parentNode.insertBefore(tierInfoContainer, cartSummary);
                } else {
                    document.querySelector('.add-to-cart-section')?.appendChild(tierInfoContainer);
                }
            }
            
            if (!combinedQuantity || combinedQuantity <= 0 || !tierKey) {
                tierInfoContainer.innerHTML = '';
                tierInfoContainer.style.display = 'none';
                return;
            }
            
            tierInfoContainer.style.display = 'block';
            const sourceTierData = window.nwcaPricingData?.tierData || window.dp5ApiTierData;
            
            if (!sourceTierData) {
                tierInfoContainer.innerHTML = '<p>Tier data unavailable.</p>';
                return;
            }
            
            // Determine if we're using cart quantities for prospective pricing
            const cartQuantity = window.cartItemData?.cartQuantity || 0;
            const newQuantity = window.cartItemData?.totalQuantity || 0;
            const isProspectivePricing = cartQuantity > 0;
            
            // Enhanced title with prospective pricing indication
            let explanationHTML = `<div class="tier-explanation">`;
            
            if (isProspectivePricing) {
                explanationHTML += `
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0;">Current Pricing Tier: <span id="current-tier-display">${tierKey}</span></h4>
                        <span style="background-color: #0d6efd; color: white; font-size: 0.75em; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">PROSPECTIVE</span>
                    </div>
                    <div style="background-color: #e8f4ff; padding: 8px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #0d6efd;">
                        <div style="font-weight: bold; margin-bottom: 5px;">Prospective Pricing Summary:</div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                            <span>Items being added:</span>
                            <span>${newQuantity}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                            <span>Items already in cart:</span>
                            <span>${cartQuantity}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 1px dashed #0d6efd; margin-top: 5px; padding-top: 5px; font-weight: bold;">
                            <span>Combined total:</span>
                            <span>${combinedQuantity}</span>
                        </div>
                    </div>`;
            } else {
                explanationHTML += `<h4>Current Pricing Tier: <span id="current-tier-display">${tierKey}</span></h4>`;
            }
            
            explanationHTML += `<p>Pricing is based on ${combinedQuantity} total ${getEmbellishmentTypeFromUrl().replace('-', ' ')} items${isProspectivePricing ? ' (including cart)' : ''}.</p></div>`;
            
            // Progress bar section
            let progressHTML = '';
            const sortedTiers = Object.keys(sourceTierData).sort((a, b) => (sourceTierData[a].MinQuantity || 0) - (sourceTierData[b].MinQuantity || 0));
            const tierPoints = sortedTiers.map(t => ({ tier: t, min: sourceTierData[t].MinQuantity || 0 }));
            const currentTierIndex = tierPoints.findIndex(p => p.tier === tierKey);
            let progressPercent = 0;
            let progressMessage = 'You are at this pricing tier.';
            
            if (currentTierIndex >= 0 && currentTierIndex < tierPoints.length - 1) {
                const nextTierPoint = tierPoints[currentTierIndex + 1];
                const currentMin = tierPoints[currentTierIndex].min;
                const nextMin = nextTierPoint.min;
                
                if (nextMin > currentMin) {
                    progressPercent = Math.min(100, Math.max(0, ((combinedQuantity - currentMin) / (nextMin - currentMin)) * 100));
                }
                
                if (quantityForNextTier > 0) {
                    progressMessage = `Add <strong>${quantityForNextTier}</strong> more item${quantityForNextTier !== 1 ? 's' : ''} to reach the <strong>${nextTier}</strong> tier (${nextMin}+ items).`;
                }
            } else if (currentTierIndex === tierPoints.length - 1) {
                progressPercent = 100;
                progressMessage = 'You have reached the highest pricing tier!';
            }
            
            progressHTML = `
            <div class="tier-progress">
                <div class="tier-progress-bar" style="position: relative; display: flex; justify-content: space-between; margin-top: 15px; margin-bottom: 10px;">
                    <div class="tier-line" style="position: absolute; top: 8px; height: 2px; width: 100%; background-color: var(--primary-light); z-index: 0;"></div>
                    <div class="tier-progress-fill" style="position: absolute; top: 8px; height: 2px; background-color: var(--primary-color); z-index: 0; width: ${progressPercent}%; transition: width 0.5s ease;"></div>
                    ${tierPoints.map((point, index) => `
                        <div class="tier-point" data-tier="${point.tier}" style="display: flex; flex-direction: column; align-items: center; z-index: 1; position: relative;">
                            <div class="tier-dot ${index <= currentTierIndex ? 'active' : ''}" style="width: 16px; height: 16px; border-radius: 50%; background-color: ${index <= currentTierIndex ? 'var(--primary-color)' : 'var(--primary-light)'}; border: 2px solid var(--primary-color);"></div>
                            <div class="tier-label" style="margin-top: 5px; font-size: 0.8em; font-weight: bold;">${point.tier}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="tier-progress-text" style="text-align: center; font-size: 0.9em; margin-top: 10px;">
                    <span id="tier-progress-message">${progressMessage}</span>
                </div>
            </div>`;
            
            // LTM fee section
            const ltmFeeApplies = window.cartItemData?.ltmFeeApplies || false;
            const ltmFeePerItem = window.cartItemData?.ltmFeePerItem || 0;
            
            let ltmHTML = `
            <div class="ltm-explanation" style="display: ${ltmFeeApplies ? 'block' : 'none'}; margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid rgba(0,0,0,0.1);">
                <h4>Less Than Minimum Fee Applied</h4>
                <p>Orders under 24 pieces include a $${(window.cartItemData?.ltmFeeTotal || 50).toFixed(2)} LTM fee distributed across all items.</p>
                <p class="ltm-applied">Current LTM fee: <span class="ltm-per-item" style="color: #dc3545;">$${ltmFeePerItem.toFixed(2)}</span> per item</p>
                ${isProspectivePricing && ltmFeeApplies ? `
                <div style="font-size: 0.9em; font-style: italic; margin-top: 5px; background-color: #f8f9fa; padding: 5px; border-radius: 4px;">
                    This fee is calculated based on your prospective total of ${combinedQuantity} items.
                </div>` : ''}
            </div>`;
            
            tierInfoContainer.innerHTML = explanationHTML + progressHTML + ltmHTML;
        } catch (error) {
            console.error("[UI] Error updating tier info display:", error);
            if (tierInfoContainer) tierInfoContainer.innerHTML = `<p style="color: red;">Error displaying tier info.</p>`;
        }
    }

    function showSuccessWithViewCartButton(productData) {
        const existingContainer = document.getElementById('cart-notification-container'); if (existingContainer) document.body.removeChild(existingContainer); const notificationContainer = document.createElement('div'); notificationContainer.id = 'cart-notification-container'; notificationContainer.style.position = 'fixed'; notificationContainer.style.top = '20px'; notificationContainer.style.right = '20px'; notificationContainer.style.zIndex = '9999'; notificationContainer.style.width = '300px'; notificationContainer.style.maxWidth = '90%'; const ltmFeeApplied = productData?.pricingInfo?.ltmFeeApplied || false; if (ltmFeeApplied) { const ltmInfoBadge = document.createElement('div'); ltmInfoBadge.className = 'ltm-info-badge'; ltmInfoBadge.style.position = 'absolute'; ltmInfoBadge.style.top = '-15px'; ltmInfoBadge.style.right = '10px'; ltmInfoBadge.style.backgroundColor = '#ffc107'; ltmInfoBadge.style.color = '#212529'; ltmInfoBadge.style.padding = '3px 10px'; ltmInfoBadge.style.borderRadius = '15px'; ltmInfoBadge.style.fontSize = '0.75em'; ltmInfoBadge.style.fontWeight = 'bold'; ltmInfoBadge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; ltmInfoBadge.textContent = '⚠️ LTM Fee Applied'; notificationContainer.appendChild(ltmInfoBadge); } document.body.appendChild(notificationContainer); const notification = document.createElement('div'); notification.className = 'cart-notification'; notification.style.backgroundColor = '#fff'; notification.style.borderRadius = '8px'; notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; notification.style.marginBottom = '10px'; notification.style.overflow = 'hidden'; notification.style.animation = 'slideIn 0.3s ease-out forwards'; if (!document.getElementById('cart-notification-styles')) { const styleEl = document.createElement('style'); styleEl.id = 'cart-notification-styles'; styleEl.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes fadeOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } } .cart-notification.removing { animation: fadeOut 0.3s ease-in forwards; } .ltm-fee-notification { box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3); border: 1px solid #ffc107; } .ltm-info-badge { animation: pulse 2s infinite; } @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`; document.head.appendChild(styleEl); } const styleNumber = productData?.styleNumber || 'N/A'; const colorCode = productData?.color || 'N/A'; const embType = productData?.embellishmentType || 'N/A'; const totalQuantity = productData?.totalQuantity || 0; const sizes = productData?.sizes || []; const sizeText = sizes.map(size => `${size.size}: ${size.quantity}`).join(', '); const totalPrice = sizes.reduce((sum, size) => sum + (size.totalPrice || 0), 0); let statusBgColor = '#28a745'; let statusIcon = '✓'; let statusMessage = 'Added to Cart'; let textColor = 'white'; if (ltmFeeApplied) { statusBgColor = '#ffc107'; statusIcon = '⚠️'; statusMessage = 'Added with LTM Fee'; textColor = '#212529'; notification.classList.add('ltm-fee-notification'); } notification.innerHTML = `<div style="background-color:${statusBgColor};color:${textColor};padding:10px;display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;"><span style="font-size:16px;margin-right:8px;">${statusIcon}</span><span style="font-weight:bold;">${statusMessage}</span></div><button class="close-notification" style="background:none;border:none;color:${textColor};font-size:18px;cursor:pointer;padding:0;line-height:1;">×</button></div><div style="padding:15px;"><div style="margin-bottom:10px;font-weight:bold;font-size:16px;">Item Added</div><div style="display:flex;margin-bottom:12px;"><div style="flex:0 0 80px;height:80px;margin-right:10px;border:1px solid #e9ecef;overflow:hidden;display:flex;align-items:center;justify-content:center;background-color:#f8f9fa;">${productData.imageUrl ? `<img src="${productData.imageUrl}" alt="${styleNumber} ${colorCode}" style="max-width:100%;max-height:100%;object-fit:contain;">` : `<div style="display:flex;align-items:center;justify-content:center;font-size:11px;text-align:center;color:#6c757d;flex-direction:column;"><span>${styleNumber}</span><span>${colorCode}</span></div>`}</div><div style="flex:1;"><div style="margin-bottom:4px;font-weight:bold;">Style #${styleNumber}</div><div style="margin-bottom:4px;color:#6c757d;">Color: ${colorCode}</div><div style="margin-bottom:4px;color:#6c757d; text-transform: capitalize;">${embType.replace('-', ' ')}</div></div></div><div style="background-color:${ltmFeeApplied ? '#fff3cd' : '#f8f9fa'};padding:8px;border-radius:4px;margin-bottom:12px;border:${ltmFeeApplied ? '1px solid #ffc107' : '1px solid #eee'};"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Quantity:</span><span>${totalQuantity}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Sizes:</span><span style="text-align:right;max-width:70%;">${sizeText || 'N/A'}</span></div><div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Total:</span><span>$${totalPrice.toFixed(2)}</span></div></div><div style="display:flex;justify-content:space-between;"><button class="continue-shopping" style="padding:8px 16px;background-color:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;cursor:pointer;">Continue Shopping</button><button class="view-cart" style="padding:8px 16px;background-color:${ltmFeeApplied ? '#ffc107' : '#0056b3'};color:${ltmFeeApplied ? '#212529' : 'white'};border:none;border-radius:4px;cursor:pointer;font-weight:bold;">View Cart</button></div></div>`; function removeNotification(notif) { if (!notif || !notif.parentNode || notif.classList.contains('removing')) return; notif.classList.add('removing'); notif.addEventListener('animationend', function() { if (notif.parentNode) { notif.parentNode.removeChild(notif); if (notificationContainer.children.length === 0 && notificationContainer.parentNode) { notificationContainer.parentNode.removeChild(notificationContainer); } } }); setTimeout(() => { if (notif.parentNode) { notif.parentNode.removeChild(notif); if (notificationContainer.children.length === 0 && notificationContainer.parentNode) { notificationContainer.parentNode.removeChild(notificationContainer); } } }, 500); } notification.querySelector('.close-notification').addEventListener('click', () => removeNotification(notification)); notification.querySelector('.continue-shopping').addEventListener('click', () => removeNotification(notification)); notification.querySelector('.view-cart').addEventListener('click', () => { if (window.NWCACart?.openCart) window.NWCACart.openCart(); else window.location.href = '/cart'; removeNotification(notification); }); notificationContainer.appendChild(notification); setTimeout(() => removeNotification(notification), 6000);
    }

    function handleMobileAdjustments() {
        const isMobile = window.innerWidth <= 768; const isSmallMobile = window.innerWidth <= 480; const useGrid = window.ProductQuantityUI ? determineLayoutPreference() : false; console.log(`PricingPages: Handling mobile adjustments. isMobile: ${isMobile}, isSmallMobile: ${isSmallMobile}, useGridPreference: ${useGrid}`); const colorSwatches = document.querySelectorAll('.color-swatch'); colorSwatches.forEach(swatch => { const size = isSmallMobile ? '45px' : (isMobile ? '50px' : '60px'); swatch.style.width = size; swatch.style.height = size; }); const pricingGrid = document.getElementById('custom-pricing-grid'); if (pricingGrid) { pricingGrid.classList.toggle('mobile-view', isMobile); pricingGrid.style.fontSize = isSmallMobile ? '0.8em' : (isMobile ? '0.9em' : ''); const pricingGridContainer = document.querySelector('.pricing-grid-container'); if (pricingGridContainer) { pricingGridContainer.style.overflowX = isMobile ? 'auto' : ''; pricingGridContainer.style.WebkitOverflowScrolling = isMobile ? 'touch' : ''; } } const productContext = document.querySelector('.product-context'); if (productContext) { productContext.style.flexDirection = isMobile ? 'column' : ''; productContext.style.textAlign = isMobile ? 'center' : ''; } const quantityMatrixContainer = document.getElementById('quantity-matrix'); const sizeQuantityGridContainer = document.getElementById('size-quantity-grid-container'); if (quantityMatrixContainer) { quantityMatrixContainer.style.display = (!useGrid && !isSmallMobile) ? 'block' : 'none'; if (!useGrid && !isSmallMobile) { const matrixTable = quantityMatrixContainer.querySelector('.quantity-input-table'); if (matrixTable) matrixTable.classList.toggle('mobile-view', isMobile); } } if (sizeQuantityGridContainer) { sizeQuantityGridContainer.style.display = (useGrid || isSmallMobile) ? 'grid' : 'none'; if (useGrid || isSmallMobile) { sizeQuantityGridContainer.style.gridTemplateColumns = isSmallMobile ? '1fr' : (isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))'); } } const visibleContainerSelector = (useGrid || isSmallMobile) ? '#size-quantity-grid-container' : '#quantity-matrix'; const visibleContainer = document.querySelector(visibleContainerSelector); if (visibleContainer) { visibleContainer.querySelectorAll('.quantity-btn').forEach(btn => { const size = isSmallMobile ? '22px' : (isMobile ? '24px' : '26px'); const fontSize = isSmallMobile ? '0.8em' : (isMobile ? '0.9em' : '1em'); btn.style.width = size; btn.style.height = size; btn.style.fontSize = fontSize; }); visibleContainer.querySelectorAll('.quantity-input').forEach(input => { const width = isSmallMobile ? '30px' : (isMobile ? '35px' : '40px'); const height = isSmallMobile ? '22px' : (isMobile ? '24px' : '26px'); const fontSize = isSmallMobile ? '0.8em' : (isMobile ? '0.9em' : '1em'); input.style.width = width; input.style.height = height; input.style.fontSize = fontSize; }); if (visibleContainerSelector === '#size-quantity-grid-container') { visibleContainer.querySelectorAll('.size-quantity-item').forEach(item => { item.style.padding = isSmallMobile ? '8px' : '10px'; }); } else if (visibleContainerSelector === '#quantity-matrix') { visibleContainer.querySelectorAll('th, td').forEach(cell => { cell.style.padding = isSmallMobile ? '4px' : (isMobile ? '6px' : '8px'); }); } } const cartSummary = document.querySelector('.cart-summary'); if (cartSummary) { cartSummary.style.padding = isMobile ? '15px' : '20px'; const addToCartButton = cartSummary.querySelector('#add-to-cart-button'); if (addToCartButton) { addToCartButton.style.padding = isSmallMobile ? '8px 16px' : '12px 24px'; addToCartButton.style.fontSize = isSmallMobile ? '1em' : '1.1em'; } const tierInfoDisplay = cartSummary.querySelector('#tier-info-display'); if (tierInfoDisplay) { tierInfoDisplay.style.padding = isSmallMobile ? '8px' : '10px'; tierInfoDisplay.style.fontSize = isSmallMobile ? '0.85em' : '0.9em'; const progressBar = tierInfoDisplay.querySelector('.tier-progress'); if(progressBar) progressBar.style.height = isSmallMobile ? '6px' : '8px'; const progressBarFill = tierInfoDisplay.querySelector('.tier-progress-fill'); if(progressBarFill) progressBarFill.style.height = isSmallMobile ? '6px' : '8px'; } } const tierInfoBox = document.getElementById('tier-info-display'); if (tierInfoBox && tierInfoBox !== cartSummary?.querySelector('#tier-info-display')) { tierInfoBox.style.padding = isMobile ? '10px' : '15px'; tierInfoBox.style.fontSize = isSmallMobile ? '0.85em' : '0.9em'; } setupShowMoreColorsButton();
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
        updateCartInfoDisplay: updateCartInfoDisplay,
        updateTierInfoDisplay: updateTierInfoDisplay,
        showSuccessNotification: showSuccessWithViewCartButton,
        handleMobileAdjustments: handleMobileAdjustments,
        updateMiniColorSwatch: updateMiniColorSwatch,
        determineLayoutPreference: determineLayoutPreference // Added function reference
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