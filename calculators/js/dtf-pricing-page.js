/* dtf-pricing-page.js — the page script for /calculators/dtf-pricing.html, extracted 2026-09-06 from its inline <script>
 * (Rule 3). Kept at global scope on purpose: it was global before, and the shared calculator scripts call some
 * of these functions by name. Logging is gated (localhost or ?debug=1); console.error/warn stay live. */
var DTF_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var dtfLog = DTF_LOG_ON ? console.log.bind(console) : function () {};
// Proxy host from /config/app.config.js (Rule 6) — never guess a backend.
var DTF_API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
if (!DTF_API_BASE) console.error('[dtf-pricing] APP_CONFIG.API.BASE_URL missing — pricing cannot load');

// Visible failure without a modal dialog: an inline role=alert card at the top of the page content.
function dtfInlineAlert(message) {
    var host = document.querySelector('main') || document.body;
    var el = document.createElement('div');
    el.className = 'calc-inline-alert'; el.setAttribute('role', 'alert');
    el.textContent = message;
    host.insertAdjacentElement('afterbegin', el);
    el.scrollIntoView({ block: 'nearest' });
}
// Initialize DTF page
document.addEventListener('DOMContentLoaded', function() {
    dtfLog('[DTF] Page initialized with V2 calculator');

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);

    // CHECK FOR MANUAL COST OVERRIDE FIRST
    const manualCost = urlParams.get('manualCost') || urlParams.get('cost');

    if (manualCost && !isNaN(parseFloat(manualCost))) {
        dtfLog('🔧 MANUAL PRICING MODE - Base cost:', parseFloat(manualCost));
        loadManualDTFPricing(parseFloat(manualCost));
        return; // Skip normal product loading
    }

    // NORMAL FLOW
    dtfLog('===================================');
    dtfLog('🚀 DTF Pricing System: API-Powered Calculator');
    dtfLog('📡 API endpoint: ' + DTF_API_BASE + '/api/pricing-bundle?method=DTF');
    dtfLog('📊 Using live pricing data from Caspio tables');
    dtfLog('✅ Labor cost, freight, and transfer prices from API');
    dtfLog('===================================');

    // Listen for product data from existing pricing-pages.js system
    const styleNumber = urlParams.get('StyleNumber');
    dtfLog('🚀 [DTF] Initial URL check - StyleNumber:', styleNumber);

    // Listen for the productColorsReady event that's already working
    window.addEventListener('productColorsReady', function(e) {
        dtfLog('✅ [DTF] Received productColorsReady event:', e.detail);

        // Extract data from event - now includes top-level fields
        const productData = {
            productTitle: e.detail.productTitle,
            PRODUCT_DESCRIPTION: e.detail.productDescription,
            BRAND_NAME: e.detail.brandName,
            colors: e.detail.colors,
            selectedColor: e.detail.selectedColor,
            // Pass through full product data for calculator
            product: e.detail
        };

        // Use the working data to update our UI
        updateProductInfo(productData, e.detail.styleNumber || styleNumber);

        // Update DTF calculator with full product data for upcharge tooltip
        // Check both possible calculator locations
        const calculator = window.dtfCalculator || window.dtfIntegration?.calculator;
        if (calculator && e.detail) {
            dtfLog('🎯 [DTF] Updating calculator with product upcharges and sizes');
            dtfLog('📍 [DTF] Calculator found at:', window.dtfCalculator ? 'window.dtfCalculator' : 'window.dtfIntegration.calculator');

            // Set upcharges data
            if (e.detail.sellingPriceDisplayAddOns || e.detail.upcharges) {
                calculator.productUpcharges = e.detail.sellingPriceDisplayAddOns || e.detail.upcharges || {};
                dtfLog('✅ [DTF] Upcharges set:', calculator.productUpcharges);
            }

            // Set sizes data
            if (e.detail.sizes) {
                calculator.productSizes = Array.isArray(e.detail.sizes)
                    ? e.detail.sizes.map(s => s.size || s)
                    : [];
                dtfLog('✅ [DTF] Sizes set:', calculator.productSizes);
            }

            // Force tooltip update if it's visible
            if (calculator.updateUpchargeTooltipContent && typeof calculator.updateUpchargeTooltipContent === 'function') {
                dtfLog('🔄 [DTF] Forcing tooltip content update');
                calculator.updateUpchargeTooltipContent();
            }
        } else {
            console.warn('⚠️ [DTF] Calculator not found yet, data may be picked up by event listener');
        }

        // Hide loading, show product
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('productHero').style.display = 'block';
        dtfLog('✨ [DTF] Product display complete from event');
    });

    // Fallback: Show product hero after 3 seconds even if event doesn't fire
    setTimeout(function() {
        const loadingState = document.getElementById('loadingState');
        const productHero = document.getElementById('productHero');

        if (loadingState && loadingState.style.display !== 'none') {
            dtfLog('⏱️ [DTF] Fallback timer: Showing product hero after 3s');
            loadingState.style.display = 'none';
            productHero.style.display = 'block';

            // Set basic fallback info if we don't have product data yet
            if (styleNumber) {
                document.getElementById('productTitle').textContent = styleNumber;
                document.getElementById('productDescription').textContent = 'Direct-to-Film transfer printing';
                document.getElementById('currentStyle').textContent = `#${styleNumber.toUpperCase()}`;
                document.getElementById('currentBrand').textContent = getBrandFromStyle(styleNumber);
            }
        }
    }, 3000);

    // Setup search functionality
    setupSearch();

    // Handle calculator ready state
    setTimeout(function() {
        const loadingDiv = document.querySelector('.dtf-calculator-loading');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
    }, 100);

    // Listen for product data updates
    window.addEventListener('productDataUpdated', function(event) {
        dtfLog('[DTF] Product data updated:', event.detail);

        // Extract pricing data
        const productData = event.detail;
        const pricingData = {
            garmentCost: productData.price || productData.basePrice || productData.garmentPrice || 0,
            quantity: productData.quantity || 24,
            productInfo: {
                name: productData.name || productData.productName || productData.title,
                sku: productData.sku || productData.styleNumber,
                image: productData.imageUrl || productData.image
            }
        };

        // Update DTF calculator via adapter - force immediate update for product changes
        if (window.DTFAdapter) {
            window.DTFAdapter.updateData(pricingData);

            // Also trigger refresh on the calculator directly if it exists
            if (window.dtfIntegration && window.dtfIntegration.calculator) {
                setTimeout(() => {
                    dtfLog('[DTF] Triggering calculator refresh after product update');
                    window.dtfIntegration.calculator.refreshTransferPricing();
                }, 100);
            }
        }
    });

    // Listen for pricing data loaded event (from DTG/pricing system)
    window.addEventListener('pricingDataLoaded', async function(event) {
        dtfLog('[DTF] Pricing data loaded:', event.detail);

        // Check if this is fallback pricing data
        if (event.detail && event.detail.isFallback) {
            dtfLog('[DTF] Detected fallback pricing - fetching real garment costs from API');

            const urlParams = new URLSearchParams(window.location.search);
            const styleNumber = event.detail.styleNumber || urlParams.get('StyleNumber');
            if (styleNumber && window.DTFAdapter) {
                const realCost = await window.DTFAdapter.fetchAndSetGarmentCost(styleNumber);
                if (realCost !== null) {
                    dtfLog('[DTF] Successfully fetched real garment cost:', realCost);
                    // Force a refresh after API cost is loaded
                    if (window.dtfIntegration && window.dtfIntegration.calculator) {
                        setTimeout(() => {
                            window.dtfIntegration.calculator.refreshTransferPricing();
                        }, 50);
                    }
                    return; // Exit early, we've set the real cost
                }
            }
        }

        if (event.detail && event.detail.prices) {
            // Extract base garment price from first tier, first size group
            // For DTF, we need the garment-only price (0 colors/locations)
            let garmentPrice = 0;

            // Try to get price from first size group and first tier
            const sizeGroups = Object.keys(event.detail.prices);
            if (sizeGroups.length > 0) {
                const firstSizeGroup = sizeGroups[0];
                const tierPrices = event.detail.prices[firstSizeGroup];
                const firstTier = Object.keys(tierPrices)[0];
                if (firstTier && tierPrices[firstTier]) {
                    garmentPrice = tierPrices[firstTier];
                }
            }

            const pricingData = {
                garmentCost: garmentPrice,
                quantity: 24, // Default quantity
                productInfo: {
                    name: event.detail.productTitle,
                    sku: event.detail.styleNumber,
                    color: event.detail.color
                }
            };

            if (window.DTFAdapter) {
                window.DTFAdapter.updateData(pricingData);

                // Force refresh after pricing data is loaded
                if (window.dtfIntegration && window.dtfIntegration.calculator) {
                    setTimeout(() => {
                        window.dtfIntegration.calculator.refreshTransferPricing();
                    }, 100);
                }
            }
        }
    });

    // Listen for pricing matrix API events
    window.addEventListener('pricingMatrixDataAvailable', function(event) {
        dtfLog('[DTF] Pricing matrix data available:', event.detail);

        // Try to get garment price from the pricing matrix
        if (event.detail && event.detail.data) {
            // Look for the base garment price (usually first row or "0" colors)
            let garmentPrice = 0;

            // Check if data has a structure like DTG or screen print
            if (event.detail.data.primaryLocationPricing && event.detail.data.primaryLocationPricing["0"]) {
                // Screen print style data structure
                const zeroColorPricing = event.detail.data.primaryLocationPricing["0"];
                if (zeroColorPricing.tiers && zeroColorPricing.tiers.length > 0) {
                    const firstTier = zeroColorPricing.tiers[0];
                    const sizes = Object.keys(firstTier.prices || {});
                    if (sizes.length > 0) {
                        garmentPrice = firstTier.prices[sizes[0]];
                    }
                }
            } else if (event.detail.data.rows) {
                // Table-based structure
                const rows = event.detail.data.rows;
                if (rows.length > 0 && rows[0].cells && rows[0].cells.length > 1) {
                    // Try to parse the first price cell
                    const priceText = rows[0].cells[1];
                    const price = parseFloat(priceText.replace(/[$,]/g, ''));
                    if (!isNaN(price)) {
                        garmentPrice = price;
                    }
                }
            }

            if (garmentPrice > 0) {
                const pricingData = {
                    garmentCost: garmentPrice,
                    quantity: 24,
                    productInfo: {
                        name: event.detail.productTitle || window.selectedColorName,
                        sku: event.detail.styleNumber || urlParams.get('StyleNumber')
                    }
                };

                dtfLog('[DTF] Sending garment price from matrix:', pricingData);
                if (window.DTFAdapter) {
                    window.DTFAdapter.updateData(pricingData);
                }
            }
        }
    });

    // Also listen for pricing matrix data (legacy support)
    window.addEventListener('pricingMatrixDataReceived', function(event) {
        dtfLog('[DTF] Pricing matrix data received:', event.detail);

        if (event.detail && event.detail.price) {
            const pricingData = {
                garmentCost: event.detail.price,
                quantity: event.detail.quantity || 24
            };

            if (window.DTFAdapter) {
                window.DTFAdapter.updateData(pricingData);
            }
        }
    });

    // Check for initial URL parameters
    // urlParams already declared above, reusing it
    const initialData = {};
    let hasData = false;

    // Map common parameter names
    const garmentCost = urlParams.get('price') || urlParams.get('garmentCost') || urlParams.get('cost');
    const quantity = urlParams.get('quantity') || urlParams.get('qty');
    const productName = urlParams.get('productName') || urlParams.get('name');
    const sku = urlParams.get('sku');

    if (garmentCost) {
        initialData.garmentCost = parseFloat(garmentCost);
        hasData = true;
    }

    if (quantity) {
        initialData.quantity = parseInt(quantity);
        hasData = true;
    }

    if (productName || sku) {
        initialData.productInfo = {
            name: productName,
            sku: sku
        };
        hasData = true;
    }

    // Send initial data if available
    if (hasData && window.DTFAdapter) {
        dtfLog('[DTF] Sending initial URL data:', initialData);
        window.DTFAdapter.updateData(initialData);
    }

    // Listen for API errors
    window.addEventListener('dtfApiError', function(event) {
        console.error('[DTF] API Error detected:', event.detail);

        // Show user-friendly error message
        const container = document.getElementById('dtf-calculator-container');
        if (container) {
            const errorHTML = `
                <div class="alert alert-danger" role="alert">
                    <h4 class="alert-heading">
                        <i class="fas fa-exclamation-circle" aria-hidden="true"></i> Connection Error
                    </h4>
                    <p>We're unable to retrieve pricing information at this time.</p>
                    <hr>
                    <p class="mb-0">
                        <strong>Please call for a quote: 253-922-5793</strong><br>
                        <small>Error: ${event.detail.error || 'Network connection failed'}</small>
                    </p>
                </div>
            `;

            // Insert error at the top of the calculator
            const existingError = container.querySelector('.alert-danger');
            if (!existingError) {
                container.insertAdjacentHTML('afterbegin', errorHTML);
            }
        }
    });

    // Dispatch event to signal DTF page is ready
    window.dispatchEvent(new CustomEvent('dtfPageReady', {
        detail: {
            embellishmentType: 'dtf',
            calculatorVersion: 'v2',
            useQuoteSystem: false
        }
    }));

    // Try to fetch pricing data if not received after a delay
    setTimeout(function() {
        if (!window.DTFAdapter || !window.DTFAdapter.getData || window.DTFAdapter.getData().garmentCost === 0) {
            dtfLog('[DTF] No pricing data received, attempting to fetch...');

            // Try to trigger pricing data load
            if (window.PricingMatrixAPI && window.PricingMatrixAPI.fetchPricingData) {
                const styleNumber = urlParams.get('StyleNumber');
                const color = urlParams.get('COLOR') || urlParams.get('color');

                if (styleNumber) {
                    dtfLog('[DTF] Requesting pricing data for:', styleNumber, color);
                    window.PricingMatrixAPI.fetchPricingData(styleNumber, 'dtf', color);
                }
            }

            // Also try to get data from the pricing matrix if it exists
            if (window.PricingMatrix && window.PricingMatrix.data) {
                dtfLog('[DTF] Found existing pricing matrix data:', window.PricingMatrix.data);
                // Dispatch event with the data
                window.dispatchEvent(new CustomEvent('pricingMatrixDataAvailable', {
                    detail: {
                        data: window.PricingMatrix.data,
                        styleNumber: urlParams.get('StyleNumber')
                    }
                }));
            }
        }
    }, 2000); // Wait 2 seconds for normal data flow

    // ========================================
    // PRODUCT DATA FUNCTIONS
    // ========================================

    // Helper function to get brand from style number prefix
    function getBrandFromStyle(styleNumber) {
        const stylePrefix = styleNumber.toUpperCase().replace(/[0-9]/g, '');
        const brandMap = {
            'PC': 'Port & Company',
            'DT': 'District',
            'SP': 'Sport-Tek',
            'DM': 'District Made',
            'AA': 'Alternative Apparel',
            'NL': 'Next Level',
            'G': 'Gildan',
            'ST': 'Sport-Tek',
            'TSC': 'The Supply Chain',
            'LST': 'Sport-Tek Ladies',
            'YST': 'Sport-Tek Youth'
        };
        return brandMap[stylePrefix] || 'Premium Brand';
    }

    // REMOVED: fetchAndDisplayProduct() - This function tried to fetch from /api/product-details which doesn't exist
    // Instead, we now listen for the 'productColorsReady' event dispatched by pricing-pages.js
    // which successfully fetches from /api/product-colors and provides all the data we need.
    // The working event listener is in the initialization code below.

    /**
     * Load manual DTF pricing mode with synthetic data
     */
    async function loadManualDTFPricing(manualCost) {
        dtfLog(`🔧 Loading manual DTF pricing with base cost: ${manualCost.toFixed(2)}`);

        try {
            // Show product hero section
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('productHero').style.display = 'block';

            // Instantiate the DTF service
            dtfLog('📡 Creating DTF service instance...');
            const dtfService = new DTFPricingService();

            // Generate manual pricing data from API
            dtfLog('📡 Fetching DTF pricing data from API...');
            const pricingData = await dtfService.generateManualPricingData(manualCost);
            dtfLog('✅ Manual DTF pricing data generated:', {
                totalTiers: pricingData.tiersR?.length || pricingData.tiers?.length,
                totalCosts: pricingData.allDtfCostsR?.length,
                manualCost: pricingData.manualCost,
                sampleCosts: pricingData.allDtfCostsR?.slice(0, 4).map(c =>
                    `${c.size} ${c.quantity_range}: $${c.unit_price}`)
            });

            // Store in the service for calculator access
            dtfService.apiData = pricingData;
            window.dtfService = dtfService;

            // Dispatch event so DTF calculator can pick up the data
            window.dispatchEvent(new CustomEvent('dtfManualPricingLoaded', {
                detail: pricingData
            }));

            // CRITICAL: Directly set garment cost in calculator (manual mode)
            // The calculator needs garment cost to perform pricing calculations
            if (window.dtfCalculator) {
                dtfLog('🔧 Setting manual garment cost in calculator:', manualCost);
                window.dtfCalculator.updateGarmentCost(manualCost);
            } else {
                // Calculator not ready yet, wait for it
                dtfLog('⏳ Calculator not ready, waiting for dtfCalculatorReady event...');
                window.addEventListener('dtfCalculatorReady', () => {
                    dtfLog('🔧 Calculator ready, setting manual cost:', manualCost);
                    window.dtfCalculator.updateGarmentCost(manualCost);
                }, { once: true });
            }

            // Update product info for manual mode
            const manualProduct = {
                productTitle: 'Manual DTF Pricing Mode',
                BRAND_NAME: 'Manual Entry',
                PRODUCT_DESCRIPTION: `Base cost: $${manualCost.toFixed(2)} - No product images available in manual mode`,
                colors: [],
                selectedColor: null
            };

            updateProductInfo(manualProduct, 'MANUAL');

            // Hide product image
            const productImage = document.querySelector('.product-image-main');
            if (productImage) {
                productImage.style.display = 'none';
            }

            // Initialize DTF calculator with manual mode
            // The DTF integration will handle pricing calculations
            dtfLog('✅ Manual DTF pricing mode loaded successfully');

        } catch (error) {
            console.error('❌ Error loading manual DTF pricing:', error);
            dtfInlineAlert('Failed to load manual pricing mode. Please refresh and try again.');
        }
    }

    // Update product information with images and colors
    function updateProductInfo(product, styleNumber) {
        dtfLog('📝 [DTF] updateProductInfo called');
        dtfLog('📦 [DTF] Product data:', product);
        dtfLog('🏷️ [DTF] Style number:', styleNumber);

        // DIAGNOSTIC: Log exact structure to identify field names
        dtfLog('🔍 [DTF] DIAGNOSTIC - Full product object:', JSON.stringify(product, null, 2));
        dtfLog('🔍 [DTF] DIAGNOSTIC - Product keys:', Object.keys(product));
        dtfLog('🔍 [DTF] DIAGNOSTIC - Checking image fields:');
        dtfLog('  - FRONT_MODEL:', product.FRONT_MODEL);
        dtfLog('  - FRONT_FLAT:', product.FRONT_FLAT);
        dtfLog('  - PRODUCT_IMAGE:', product.PRODUCT_IMAGE);
        dtfLog('  - front_model:', product.front_model);
        dtfLog('  - frontModel:', product.frontModel);
        dtfLog('  - image:', product.image);
        dtfLog('  - imageUrl:', product.imageUrl);
        dtfLog('🔍 [DTF] DIAGNOSTIC - Colors data:', product.colors);
        if (product.colors) {
            dtfLog('🔍 [DTF] DIAGNOSTIC - Colors array length:', product.colors.length);
            if (product.colors.length > 0) {
                dtfLog('🔍 [DTF] DIAGNOSTIC - First color object:', product.colors[0]);
                dtfLog('🔍 [DTF] DIAGNOSTIC - First color keys:', Object.keys(product.colors[0]));
            }
        }

        // Update breadcrumb Products link - link back to specific product page
        const productsBreadcrumb = document.getElementById('products-breadcrumb');
        if (productsBreadcrumb && styleNumber) {
            productsBreadcrumb.href = `/product.html?StyleNumber=${encodeURIComponent(styleNumber)}`;
            dtfLog('✅ Updated breadcrumb to product page:', styleNumber);
        } else if (productsBreadcrumb) {
            // Fallback to main catalog if no style number
            productsBreadcrumb.href = '/';
            dtfLog('⚠️ No style number, breadcrumb links to main catalog');
        }

        // Use PRODUCT_TITLE from API or fallback
        const title = product.PRODUCT_TITLE || product.title || styleNumber;

        // Use PRODUCT_DESCRIPTION from API or fallback
        const description = product.PRODUCT_DESCRIPTION || product.description || 'Direct-to-Film transfer printing';

        // Use BRAND_NAME from API, with intelligent fallback
        const brand = product.BRAND_NAME || product.brand || getBrandFromStyle(styleNumber);

        document.getElementById('productTitle').textContent = title;
        document.getElementById('productDescription').textContent = description;
        document.getElementById('currentStyle').textContent = `#${styleNumber.toUpperCase()}`;
        document.getElementById('currentBrand').textContent = brand;
        dtfLog('✏️ [DTF] Text fields updated:', { title, description, brand });

        // Update product image
        dtfLog('🖼️ [DTF] Calling updateProductImage...');
        updateProductImage(product);

        // Update color swatches
        dtfLog('🎨 [DTF] Calling updateColorSwatches...');
        updateColorSwatches(product);

        dtfLog('✅ [DTF] Product info update complete');
    }

    // Update product image
    function updateProductImage(product) {
        dtfLog('🖼️ [DTF] updateProductImage called');
        const imageEl = document.getElementById('productImage');
        const placeholderEl = document.getElementById('imagePlaceholder');

        // Try selectedColor first (most reliable source)
        const selectedColor = product.selectedColor || (product.colors && product.colors[0]);

        if (selectedColor) {
            const imageUrl = selectedColor.MAIN_IMAGE_URL || selectedColor.FRONT_MODEL || selectedColor.FRONT_FLAT;
            if (imageUrl) {
                imageEl.src = imageUrl;
                imageEl.style.display = 'block';
                placeholderEl.style.display = 'none';
                dtfLog('✅ [DTF] Image displayed:', imageUrl);

                // Update current color
                const colorName = selectedColor.COLOR_NAME || 'Color';
                document.getElementById('currentColor').textContent = colorName;
                return;
            }
        }

        // Fallback: show placeholder
        console.warn('⚠️ [DTF] No image found');
        imageEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
        placeholderEl.innerHTML = '<i class="fas fa-tshirt" style="font-size: 48px; margin-bottom: 12px;" aria-hidden="true"></i><div>Image Not Available</div>';
    }

    // Update color swatches
    function updateColorSwatches(product) {
        dtfLog('🎨 [DTF] updateColorSwatches called');
        const swatchesSection = document.getElementById('colorSwatchesSection');
        const swatchesContainer = document.getElementById('colorSwatches');

        const colors = product.colors;
        if (!colors || colors.length === 0) {
            console.warn('⚠️ [DTF] No colors array found');
            swatchesSection.style.display = 'none';
            return;
        }

        dtfLog(`🎨 [DTF] Creating ${colors.length} color swatches`);
        swatchesContainer.innerHTML = '';

        colors.forEach((color) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.cssText = `
                width: 40px;
                height: 40px;
                border-radius: 8px;
                border: 2px solid #e5e7eb;
                cursor: pointer;
                display: inline-block;
                margin-right: 8px;
                margin-bottom: 8px;
                position: relative;
                overflow: hidden;
                transition: all 0.2s;
            `;

            // Use color square image or hex code
            if (color.COLOR_SQUARE_IMAGE) {
                swatch.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
                swatch.style.backgroundSize = 'cover';
            } else if (color.HEX_CODE) {
                swatch.style.backgroundColor = color.HEX_CODE;
            } else {
                swatch.style.background = 'linear-gradient(135deg, #f0f0f0, #e0e0e0)';
            }

            swatch.title = color.COLOR_NAME || 'Color';

            // Hover effect
            swatch.addEventListener('mouseenter', () => {
                swatch.style.transform = 'scale(1.1)';
                swatch.style.borderColor = '#4cb354';  // Updated to match DTG green
            });
            swatch.addEventListener('mouseleave', () => {
                swatch.style.transform = 'scale(1)';
                swatch.style.borderColor = '#e5e7eb';
            });

            // Click to change image
            swatch.addEventListener('click', () => {
                const imageUrl = color.MAIN_IMAGE_URL || color.FRONT_MODEL || color.FRONT_FLAT;
                if (imageUrl) {
                    document.getElementById('productImage').src = imageUrl;
                    document.getElementById('productImage').style.display = 'block';
                    document.getElementById('imagePlaceholder').style.display = 'none';
                    document.getElementById('currentColor').textContent = color.COLOR_NAME || 'Color';
                    dtfLog(`✅ [DTF] Changed to ${color.COLOR_NAME}`);

                    // Highlight selected swatch
                    document.querySelectorAll('.color-swatch').forEach(s => {
                        s.style.border = '2px solid #e5e7eb';
                    });
                    swatch.style.border = '3px solid #4cb354';  // Updated to match DTG green
                }
                // Load warehouse inventory
                if (typeof loadCalculatorInventory === 'function') {
                    loadCalculatorInventory(currentStyleNumber || window.currentStyleNumber, color.CATALOG_COLOR || color.COLOR_NAME, color.COLOR_NAME, color.COLOR_SQUARE_IMAGE);
                }
            });

            swatchesContainer.appendChild(swatch);
        });

        swatchesSection.style.display = 'block';
        dtfLog('✅ [DTF] Color swatches displayed');
    }

    // Setup search functionality with API integration
    function setupSearch() {
        const searchInput = document.getElementById('styleSearch');
        const searchBtn = document.getElementById('searchBtn');
        const searchWrapper = document.querySelector('.search-wrapper');

        // Create search results dropdown
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';
        searchWrapper.appendChild(resultsContainer);

        let searchTimeout = null;

        // Perform API search
        async function performAPISearch(query) {
            if (query.length < 2) {
                resultsContainer.classList.remove('active');
                return;
            }

            // Show loading state
            resultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Searching...</div>';
            resultsContainer.classList.add('active');

            try {
                // Search using the API endpoint
                const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`);

                if (!response.ok) {
                    throw new Error('Search failed');
                }

                const results = await response.json();

                if (results.length === 0) {
                    resultsContainer.innerHTML = '<div class="search-no-results">No products found</div>';
                } else {
                    // Build results HTML
                    let html = '';
                    results.slice(0, 10).forEach(result => {
                        html += `
                            <div class="search-result-item" data-style="${result.style || result.value}">
                                <div class="search-result-style">${result.style || result.value}</div>
                                <div class="search-result-desc">${result.label}</div>
                            </div>
                        `;
                    });
                    resultsContainer.innerHTML = html;

                    // Add click handlers to results
                    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const style = item.dataset.style;
                            window.location.href = `?StyleNumber=${style}`;
                        });
                    });
                }
            } catch (error) {
                console.error('Search error:', error);
                resultsContainer.innerHTML = '<div class="search-no-results">Search failed. Please try again.</div>';
            }
        }

        // Handle search input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Clear previous timeout
            clearTimeout(searchTimeout);

            if (query.length < 2) {
                resultsContainer.classList.remove('active');
                return;
            }

            // Debounce search
            searchTimeout = setTimeout(() => {
                performAPISearch(query);
            }, 300);
        });

        // Handle enter key for direct navigation
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = searchInput.value.trim();
                if (value) {
                    // Try direct style number navigation
                    window.location.href = `?StyleNumber=${value}`;
                }
            }
        });

        // Handle search button click
        searchBtn.addEventListener('click', () => {
            const value = searchInput.value.trim();
            if (value) {
                window.location.href = `?StyleNumber=${value}`;
            }
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchWrapper.contains(e.target)) {
                resultsContainer.classList.remove('active');
            }
        });
    }

    // ========================================
    // END PRODUCT DATA FUNCTIONS
    // ========================================
});

// Handle messages from parent window (iframe scenarios)
window.addEventListener('message', function(event) {
    // Ignore React DevTools messages
    if (event.data && event.data.source === 'react-devtools-content-script') {
        return;
    }

    dtfLog('[DTF] Received postMessage:', event.data);

    // Handle DTF-specific pricing data
    if (event.data && event.data.type === 'dtfPricingData') {
        dtfLog('[DTF] Received DTF pricing data:', event.data);
        if (window.DTFAdapter) {
            window.DTFAdapter.updateData(event.data.data);
        }
    }

    // Handle Caspio pricing data
    if (event.data && (event.data.type === 'caspioPricingData' || event.data.type === 'caspioDataReady')) {
        dtfLog('[DTF] Received Caspio pricing data:', event.data);
        const pricingData = {
            garmentCost: event.data.price || event.data.garmentPrice || event.data.basePrice || 0,
            quantity: event.data.quantity || 24,
            productInfo: {
                name: event.data.productName || event.data.name,
                sku: event.data.sku || event.data.styleNumber
            }
        };

        if (window.DTFAdapter && pricingData.garmentCost > 0) {
            window.DTFAdapter.updateData(pricingData);
        }
    }
});
