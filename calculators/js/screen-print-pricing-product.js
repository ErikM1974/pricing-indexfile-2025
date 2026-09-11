/* screen-print-pricing-product.js — product hero, colour swatches, manual-cost mode and the size-upcharge
 * panel for /calculators/screen-print-pricing.html. Extracted 2026-09-06 from the page's first inline <script>
 * (Rule 3). Runs BEFORE pricing-pages.js so its productColorsReady listener is registered in time. */
/* Debug logging gate — this is a staff calculator; the chatter (37 + 30 console.log lines across the two
 * page scripts) only prints on localhost or with ?debug=1. console.error / console.warn stay live. */
var SP_DEBUG = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var spLog = SP_DEBUG ? console.log.bind(console) : function () {};
// Proxy host from /config/app.config.js (Rule 6) — never guess a backend.
var SP_API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
if (!SP_API_BASE) console.error('[ScreenPrint] APP_CONFIG.API.BASE_URL missing — product details cannot load');

(function () {
    // Fetch full product details including title and description
    async function fetchFullProductDetails(styleNumber) {
        try {
            const apiUrl = `${SP_API_BASE}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`;
            spLog('[ScreenPrintV2] Fetching full product details from:', apiUrl);

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            spLog('[ScreenPrintV2] Received full product data:', data);
            return data;
        } catch (error) {
            console.error('[ScreenPrintV2] Error fetching product details:', error);
            return null;
        }
    }

    // Helper function to transform API data to display format
    function transformApiData(eventData, fullProductData) {
        // Get style number from URL
        const styleNumber = new URLSearchParams(window.location.search).get('StyleNumber') || 'PC61';

        // Use full product data if available, otherwise try event data
        const productTitle = fullProductData?.productTitle || eventData.productTitle || styleNumber;
        const productDescription = fullProductData?.PRODUCT_DESCRIPTION || eventData.PRODUCT_DESCRIPTION || 'Loading product information...';

        return {
            name: productTitle,
            description: productDescription,
            styleNumber: styleNumber,
            brand: extractBrand(productTitle),
            color: eventData.selectedColor?.COLOR_NAME || window.selectedColorName || 'Natural',
            imageUrl: eventData.selectedColor?.MAIN_IMAGE_URL || eventData.selectedColor?.FRONT_MODEL,
            images: getProductImages(eventData.selectedColor),
            colors: eventData.colors || fullProductData?.colors || []
        };
    }

    // Load manual screen print pricing (when ?manualCost parameter is provided)
    async function loadManualScreenPrintPricing(manualCost) {
        spLog(`🔧 Loading manual screen print pricing with base cost: $${manualCost.toFixed(2)}`);

        // Set flag to prevent duplicate calculator initialization
        window.screenPrintManualMode = true;
        spLog('🔧 Manual mode flag set - will prevent duplicate calculator initialization');

        try {
            // Show product hero section with manual info
            const productHero = document.querySelector('.product-hero-section');
            if (productHero) {
                productHero.hidden = false;
            }

            // Update product display for manual mode
            const manualProductData = {
                name: 'Manual Pricing Mode',
                description: `Base cost: $${manualCost.toFixed(2)} - No product images available in manual mode`,
                styleNumber: 'MANUAL',
                brand: 'Manual Entry',
                color: 'N/A',
                imageUrl: '',
                images: {},
                colors: []
            };

            populateProductDisplay(manualProductData);

            // Hide the product image
            const productImage = document.querySelector('.product-image-main');
            if (productImage) productImage.hidden = true;

            // Initialize screen print calculator
            if (typeof ScreenPrintPricing !== 'undefined') {
                window.screenPrintCalculator = new ScreenPrintPricing();

                // Generate manual pricing data and load it into calculator
                if (window.screenPrintCalculator.pricingService) {
                    const manualPricingData = await window.screenPrintCalculator.pricingService.generateManualPricingData(manualCost);
                    window.screenPrintCalculator.handleMasterBundle(manualPricingData);
                    spLog('[ScreenPrintV2] Calculator initialized in manual mode');
                } else {
                    console.error('[ScreenPrintV2] Pricing service not found!');
                }
            } else {
                console.error('[ScreenPrintV2] ScreenPrintPricing class not found!');
            }

        } catch (error) {
            console.error('❌ Error loading manual screen print pricing:', error);
            const host = document.getElementById('screenprint-calculator-v2') || document.body;
            host.insertAdjacentHTML('afterbegin', '<div class="sp-inline-alert" role="alert">Failed to load manual pricing mode — ' + String((error && error.message) || error).replace(/[<>&]/g, '') + '. Reload to try again.</div>');
        }
    }

    // Initialize Product Display (Custom HTML, NOT UniversalProductDisplay)
    document.addEventListener('DOMContentLoaded', function() {
        spLog('[ScreenPrintV2] DOM Ready - Initializing Product Display');

        // CHECK FOR MANUAL COST OVERRIDE FIRST
        const urlParams = new URLSearchParams(window.location.search);
        const manualCost = urlParams.get('manualCost') || urlParams.get('cost');

        if (manualCost && !isNaN(parseFloat(manualCost))) {
            spLog('🔧 MANUAL PRICING MODE - Base cost:', parseFloat(manualCost));
            loadManualScreenPrintPricing(parseFloat(manualCost));
            return; // Skip normal product loading
        }

        // NORMAL FLOW: Check if data already exists (race condition fix)
        // The productColorsReady event may have already fired before this listener registered
        if (window.productColorsData || window.productColors) {
            spLog('[ScreenPrintV2] Using pre-loaded product data (event already fired)');
            const preloadedData = window.productColorsData || window.productColors;

            // Get style number and fetch full product details
            const styleNumber = new URLSearchParams(window.location.search).get('StyleNumber') || 'PC61';
            fetchFullProductDetails(styleNumber).then(fullProductData => {
                const productData = transformApiData(preloadedData, fullProductData);
                spLog('[ScreenPrintV2] Transformed pre-loaded data:', productData);
                populateProductDisplay(productData);
                document.querySelector('.product-hero-section').hidden = false;
            });
        } else {
            spLog('[ScreenPrintV2] No pre-loaded data found, waiting for productColorsReady event');
        }

        // Listen for product colors ready event (dispatched by pricing-pages.js on WINDOW not document)
        window.addEventListener('productColorsReady', async function(e) {
            spLog('[ScreenPrintV2] Product colors ready event received:', e.detail);

            // Get style number from URL
            const styleNumber = new URLSearchParams(window.location.search).get('StyleNumber') || 'PC61';

            // Fetch full product details (includes title, description, brand)
            const fullProductData = await fetchFullProductDetails(styleNumber);

            // Transform the API data structure to match our function's expectations
            const eventData = e.detail;
            const productData = transformApiData(eventData, fullProductData);

            spLog('[ScreenPrintV2] Transformed product data:', productData);
            populateProductDisplay(productData);

            // Show the product hero section
            document.querySelector('.product-hero-section').hidden = false;
        });

        // Initialize Screen Print Calculator (skip if manual mode already initialized)
        if (window.screenPrintManualMode) {
            spLog('[ScreenPrintV2] Skipping normal calculator initialization - manual mode active');
        } else if (typeof ScreenPrintPricing !== 'undefined') {
            window.screenPrintCalculator = new ScreenPrintPricing();
            spLog('[ScreenPrintV2] Calculator initialized');
        } else {
            console.error('[ScreenPrintV2] ScreenPrintPricing class not found!');
        }
    });

    // Extract brand name from product title
    function extractBrand(title) {
        if (!title) return 'Port & Company';

        // Common brand patterns
        if (title.includes('Port & Co')) return 'Port & Company';
        if (title.includes('Gildan')) return 'Gildan';
        if (title.includes('Bella')) return 'Bella+Canvas';
        if (title.includes('Next Level')) return 'Next Level';
        if (title.includes('Hanes')) return 'Hanes';

        // Default fallback
        return 'Port & Company';
    }

    // Get product images array for gallery
    function getProductImages(colorObj) {
        if (!colorObj) return [];

        const images = [];
        if (colorObj.FRONT_MODEL) images.push(colorObj.FRONT_MODEL);
        if (colorObj.FRONT_FLAT && colorObj.FRONT_FLAT !== colorObj.FRONT_MODEL) {
            images.push(colorObj.FRONT_FLAT);
        }
        if (colorObj.BACK_FLAT) images.push(colorObj.BACK_FLAT);

        return images;
    }

    // Populate custom product display HTML
    function populateProductDisplay(productData) {
        if (!productData) {
            console.error('[ScreenPrintV2] No product data provided');
            return;
        }

        // Set product title and description
        document.getElementById('productTitle').textContent = productData.name || 'Loading...';
        document.getElementById('productDescription').textContent = productData.description || 'Loading product information...';

        // Set product details
        document.getElementById('currentColor').textContent = productData.color || 'Natural';
        document.getElementById('currentStyle').textContent = productData.styleNumber ? `#${productData.styleNumber}` : '#PC54';
        document.getElementById('currentBrand').textContent = productData.brand || 'Port & Company';

        // Set product image
        const productImage = document.getElementById('productImage');
        const imagePlaceholder = document.getElementById('imagePlaceholder');

        if (productData.imageUrl) {
            productImage.src = productData.imageUrl;
            productImage.hidden = false;
            imagePlaceholder.hidden = true;
        }

        // Handle image thumbnails if multiple images
        if (productData.images && productData.images.length > 1) {
            const thumbnailsContainer = document.getElementById('imageThumbnails');
            thumbnailsContainer.innerHTML = '';

            productData.images.forEach((imageUrl, index) => {
                const thumb = document.createElement('div');
                thumb.className = 'image-thumbnail' + (index === 0 ? ' active' : '');
                thumb.innerHTML = `<img src="${imageUrl}" alt="View ${index + 1}">`;
                thumb.onclick = () => switchProductImage(imageUrl, thumb);
                thumbnailsContainer.appendChild(thumb);
            });

            thumbnailsContainer.hidden = false;
        }

        // Populate color swatches
        if (productData.colors && productData.colors.length > 0) {
            const swatchesContainer = document.getElementById('colorSwatches');
            swatchesContainer.innerHTML = '';

            productData.colors.forEach((colorObj, index) => {
                const swatch = document.createElement('div');
                const isActive = colorObj.COLOR_NAME === productData.color;
                swatch.className = 'color-swatch' + (isActive ? ' active' : '');

                // Use the color square image as background
                if (colorObj.COLOR_SQUARE_IMAGE) {
                    swatch.style.setProperty('--swatch', `url(${colorObj.COLOR_SQUARE_IMAGE})`);
                }

                swatch.title = colorObj.COLOR_NAME || colorObj.CATALOG_COLOR || 'Color';
                swatch.onclick = () => selectColor(colorObj, swatch);
                swatchesContainer.appendChild(swatch);
            });

            document.getElementById('colorSwatchesSection').hidden = false;
        }
    }

    // Switch main product image
    function switchProductImage(imageUrl, thumbnailElement) {
        document.getElementById('productImage').src = imageUrl;

        // Update active thumbnail
        document.querySelectorAll('.image-thumbnail').forEach(thumb => {
            thumb.classList.remove('active');
        });
        thumbnailElement.classList.add('active');
    }

    // Handle color swatch selection
    function selectColor(colorObj, swatchElement) {
        // Update active swatch
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.classList.remove('active');
        });
        swatchElement.classList.add('active');

        // Update color display
        document.getElementById('currentColor').textContent = colorObj.COLOR_NAME || colorObj.CATALOG_COLOR;

        // Update product image if color has specific image
        const mainImageUrl = colorObj.MAIN_IMAGE_URL || colorObj.FRONT_MODEL;
        if (mainImageUrl) {
            const productImage = document.getElementById('productImage');
            const imagePlaceholder = document.getElementById('imagePlaceholder');
            productImage.src = mainImageUrl;
            productImage.hidden = false;
            imagePlaceholder.hidden = true;

            // Update thumbnails if multiple images
            const images = getProductImages(colorObj);
            if (images.length > 1) {
                const thumbnailsContainer = document.getElementById('imageThumbnails');
                thumbnailsContainer.innerHTML = '';

                images.forEach((imageUrl, index) => {
                    const thumb = document.createElement('div');
                    thumb.className = 'image-thumbnail' + (index === 0 ? ' active' : '');
                    thumb.innerHTML = `<img src="${imageUrl}" alt="View ${index + 1}">`;
                    thumb.onclick = () => switchProductImage(imageUrl, thumb);
                    thumbnailsContainer.appendChild(thumb);
                });

                thumbnailsContainer.hidden = false;
            } else {
                document.getElementById('imageThumbnails').hidden = true;
            }
        }

        // Update global color selection (for compatibility with existing system)
        window.selectedColorName = colorObj.COLOR_NAME;
        window.selectedCatalogColor = colorObj.CATALOG_COLOR;

        // Notify calculator of color change (if handler exists)
        if (window.screenPrintCalculator && window.screenPrintCalculator.handleColorChange) {
            window.screenPrintCalculator.handleColorChange(colorObj);
        }
    }

    // 2026-09-06: the legacy updateSizeUpchargesDisplay() panel is retired. It rendered into
    // #sp-size-upcharges-section — an id this page never had (it shipped with #sp-size-upcharges-container
    // in 2025-11), so it errored on every load and never showed; screenprint-pricing-v2 shows size pricing
    // in its own tooltip (sp-upcharge-tooltip).
})();
