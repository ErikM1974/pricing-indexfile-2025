/* embroidery-pricing-page.js — the page script for /calculators/embroidery-pricing.html, extracted 2026-09-06 from its inline <script>
 * (Rule 3). Kept at global scope on purpose: it was global before, and the shared calculator scripts call some
 * of these functions by name. Logging is gated (localhost or ?debug=1); console.error/warn stay live. */
var EMB_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var embLog = EMB_LOG_ON ? console.log.bind(console) : function () {};
// Proxy host from /config/app.config.js (Rule 6) — never guess a backend.
var EMB_API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
if (!EMB_API_BASE) console.error('[embroidery-pricing] APP_CONFIG.API.BASE_URL missing — pricing cannot load');

// Initialize embroidery pricing service
const embroideryService = new EmbroideryPricingService();

// State
let currentProduct = null;
let currentColors = [];
let selectedColor = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const productHero = document.getElementById('productHero');
const pricingSection = document.getElementById('pricingSection');
const orderInfoSection = document.getElementById('orderInfoSection');

// Initialize page
document.addEventListener('DOMContentLoaded', () => {

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);

    // CHECK FOR MANUAL COST OVERRIDE FIRST
    const manualCost = urlParams.get('manualCost') || urlParams.get('cost');

    if (manualCost && !isNaN(parseFloat(manualCost))) {
        loadManualEmbroideryPricing(parseFloat(manualCost));
        return; // Skip normal product loading
    }

    // NORMAL FLOW: Get style from URL parameter
    const styleNumber = urlParams.get('StyleNumber') || urlParams.get('STYLE_No') || urlParams.get('style');

    if (styleNumber) {
        loadProduct(styleNumber);
    } else {
        showNoProduct();
    }

    // Setup search
    setupSearch();
});

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
            // Search using the same API endpoint as the product page
            const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`);

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const results = await response.json();

            // Separate caps and non-caps
            const capResults = [];
            const flatResults = [];

            results.forEach(result => {
                // Use shared utility for filtering
                if (ProductCategoryFilter.isFlatHeadwear(result)) {
                    flatResults.push(result);
                } else if (ProductCategoryFilter.isStructuredCap(result)) {
                    capResults.push(result);
                } else {
                    flatResults.push(result);
                }
            });

            if (capResults.length > 0 && flatResults.length === 0) {
                // Only caps were found
                resultsContainer.innerHTML = `
                    <div class="search-no-results">
                        <i class="fas fa-info-circle" aria-hidden="true"></i>
                        Found ${capResults.length} cap item(s). Please use the 
                        <a href="/pricing/cap-embroidery">Cap Embroidery Pricing</a> 
                        page for structured caps.
                    </div>
                `;
            } else if (flatResults.length === 0) {
                // No results found at all
                resultsContainer.innerHTML = '<div class="search-no-results">No products found</div>';
            } else {
                // Build results HTML with filtered results
                let resultsHTML = '';

                // Add a note if caps were filtered out
                if (capResults.length > 0) {
                    resultsHTML = `
                        <div>
                            <i class="fas fa-info-circle" aria-hidden="true"></i>
                            Found ${capResults.length} cap item(s). Please use the 
                            <a href="/pricing/cap-embroidery">Cap Embroidery Pricing</a> 
                            page for structured caps.
                        </div>
                    `;
                }

                // Add the flat embroidery results
                resultsHTML += flatResults.map(result => {
                    return `
                        <div class="search-result-item" data-style="${result.value}">
                            <div class="search-result-info">
                                <div class="search-result-style">Style #${result.value}</div>
                                <div class="search-result-name">${result.label}</div>
                            </div>
                        </div>
                    `;
                }).join('');

                resultsContainer.innerHTML = resultsHTML;

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
            resultsContainer.innerHTML = '<div class="search-no-results">Search failed. Please check your connection and try again.</div>';
            showApiError('Search service is temporarily unavailable. Please try again later.');
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

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchWrapper.contains(e.target)) {
            resultsContainer.classList.remove('active');
        }
    });

    // Handle escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            resultsContainer.classList.remove('active');
            searchInput.blur();
        }
    });
}

// Load product data
async function loadProduct(styleNumber) {

    try {
        showLoading();

        // Fetch product details - API returns array
        const productResponse = await fetch(`${EMB_API_BASE}/api/product-details?styleNumber=${styleNumber}`);
        if (!productResponse.ok) {
            throw new Error(`Product details API error: ${productResponse.status}`);
        }

        const productArray = await productResponse.json();

        // API returns array - use first item or find by color
        if (!productArray || productArray.length === 0) {
            throw new Error('No product data found');
        }

        currentProduct = productArray[0]; // Use first item as base product info

        // Validate product type - stop if it's a cap
        if (!validateProductType(currentProduct, styleNumber)) {
            hideLoading();
            return; // Stop loading if wrong product type
        }

        // Update product info
        updateProductInfo(currentProduct, styleNumber);

        // Set initial main product image from product data
        setMainProductImage(currentProduct);

        // Load colors and images
        await loadColors(styleNumber);

        // Load size pricing for upcharges
        await loadSizePricing(styleNumber);

        // Load pricing data
        const pricingData = await embroideryService.fetchPricingData(styleNumber);

        // Check if we got valid data
        if (!pricingData || !pricingData.pricing) {
            throw new Error('Invalid pricing data received from API');
        }

        updatePricing(pricingData);

        // Update LTM calculator with real pricing data
        updateLTMPricingData(pricingData);

        // Update breadcrumb to pass style back to product page
        const productsBreadcrumb = document.getElementById('products-breadcrumb');
        if (productsBreadcrumb) {
            productsBreadcrumb.href = `/product.html?style=${styleNumber}`;
        }

        // Show all sections
        showProduct();

    } catch (error) {
        console.error('❌ Error loading product:', error);
        showApiError(error.message || 'Failed to load product pricing. Please try again later.');
        showNoProduct();
    }
}

// Load manual embroidery pricing (when ?manualCost parameter is provided)
async function loadManualEmbroideryPricing(manualCost) {

    try {
        showLoading();

        // Use the service's manual data generation
        const pricingData = await embroideryService.generateManualPricingData(manualCost);

        // Update product info for manual mode
        const manualProduct = {
            PRODUCT_TITLE: 'Manual Pricing Mode',
            BRAND_NAME: 'Manual Entry',
            PRODUCT_DESCRIPTION: `Base cost: $${manualCost.toFixed(2)} - No product images available in manual mode`
        };

        currentProduct = manualProduct;
        updateProductInfo(manualProduct, 'MANUAL');

        // Hide product image
        const productImage = document.querySelector('.product-image-main');
        if (productImage) productImage.style.display = 'none';

        // Update pricing display
        updatePricing(pricingData);

        // Update LTM calculator with real pricing data
        updateLTMPricingData(pricingData);

        // Show product sections
        showProduct();


    } catch (error) {
        console.error('❌ Error loading manual embroidery pricing:', error);
        showApiError('Failed to load manual pricing mode');
        showNoProduct();
    }
}

// Update product information
function updateProductInfo(product, styleNumber) {

    // Extract product info from API response
    const title = product.PRODUCT_TITLE || product.ProductTitle || product.STYLE || styleNumber.toUpperCase();
    const description = product.PRODUCT_DESCRIPTION || product.Description || product.PRODUCT_TITLE || '';
    const brand = product.BRAND_NAME || product.BRAND || product.Brand || 'Unknown Brand';

    // Update UI elements
    document.getElementById('productTitle').textContent = title;
    document.getElementById('productDescription').textContent = description;
    document.getElementById('currentStyle').textContent = `#${styleNumber.toUpperCase()}`;
    document.getElementById('currentBrand').textContent = brand;

}

// Validate if product is a cap and should use cap pricing
function validateProductType(product, styleNumber) {
    // Get product title and description for validation
    const productTitle = (product.PRODUCT_TITLE || product.ProductTitle || '').toLowerCase();
    const description = (product.PRODUCT_DESCRIPTION || product.Description || '').toLowerCase();
    const category = (product.CATEGORY || product.Category || '').toLowerCase();


    // Use shared utility for filtering
    if (ProductCategoryFilter.isFlatHeadwear(product)) {
        return true; // Valid for flat embroidery
    }

    if (ProductCategoryFilter.isStructuredCap(product)) {
        const productName = product.PRODUCT_TITLE || product.ProductTitle || `Style ${styleNumber}`;
        const reason = 'This product is a structured cap and requires cap embroidery pricing.';
        showProductMismatchOverlay(styleNumber, productName, reason);
        return false; // Invalid for flat embroidery
    }

    return true; // Valid for flat embroidery
}

// Show overlay for product type mismatch
function showProductMismatchOverlay(styleNumber, productName, reason) {

    // Check if overlay already exists
    let overlay = document.getElementById('productMismatchOverlay');

    if (!overlay) {
        // Create the overlay HTML dynamically
        const overlayHTML = `
            <div id="productMismatchOverlay" class="product-mismatch-overlay">
                <div class="product-mismatch-modal">
                    <div class="product-mismatch-icon">
                        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    </div>
                    <h2 class="product-mismatch-title">Wrong Pricing Calculator</h2>
                    <p class="product-mismatch-message" id="mismatchMessage"></p>
                    <a id="redirectButton" href="#" class="product-mismatch-button">
                        Go to Cap Embroidery Pricing →
                    </a>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        overlay = document.getElementById('productMismatchOverlay');
    }

    // Update the message
    document.getElementById('mismatchMessage').innerHTML = `
        <strong>${productName}</strong><br><br>
        ${reason}<br><br>
        Flat embroidery pricing is for shirts, polos, jackets, and beanies.
    `;

    document.getElementById('redirectButton').href = `/pricing/cap-embroidery?StyleNumber=${styleNumber}`;

    // Show the overlay
    overlay.style.display = 'flex';

    // Gray out the background content
    if (document.getElementById('productHero')) {
        document.getElementById('productHero').style.opacity = '0.3';
    }
    if (document.getElementById('pricingSection')) {
        document.getElementById('pricingSection').style.opacity = '0.3';
    }
}

// Helper function to detect generic catalog images
function isGenericProductImage(url) {
    if (!url) return true;

    // Check for generic catalog image patterns
    // These are typically: /catalog/images/[STYLE].jpg or similar
    const genericPatterns = [
        /\/catalog\/images\/[A-Z0-9]+\.jpg$/i,  // Matches /catalog/images/PC61.jpg
        /\/catalog\/[A-Z0-9]+\.jpg$/i,          // Matches /catalog/PC61.jpg
        /\/imglib\/mft\/[A-Z0-9]+\.jpg$/i       // Matches other generic patterns
    ];

    return genericPatterns.some(pattern => pattern.test(url));
}

// Set main product image and create thumbnails
function setMainProductImage(product, colorSpecific = false) {

    // Collect all available images ONLY from this specific product/color variant
    const images = [];

    // Add images in priority order, but only if they exist on THIS product variant
    if (product.FRONT_MODEL) {
        images.push({ url: product.FRONT_MODEL, label: 'Model', field: 'FRONT_MODEL' });
    }
    if (product.FRONT_FLAT) {
        images.push({ url: product.FRONT_FLAT, label: 'Flat', field: 'FRONT_FLAT' });
    }

    // Only add PRODUCT_IMAGE if it's different, not generic, and exists on this variant
    if (product.PRODUCT_IMAGE && 
        product.PRODUCT_IMAGE !== product.FRONT_MODEL && 
        product.PRODUCT_IMAGE !== product.FRONT_FLAT &&
        !isGenericProductImage(product.PRODUCT_IMAGE)) {
        images.push({ url: product.PRODUCT_IMAGE, label: 'Product', field: 'PRODUCT_IMAGE' });
    }

    // Only add back/side images if they exist on THIS color variant
    // Skip these if we're loading color-specific images to avoid mixing colors
    if (!colorSpecific || (product.BACK_FLAT && product.COLOR_NAME === selectedColor?.COLOR_NAME)) {
        if (product.BACK_FLAT) {
            images.push({ url: product.BACK_FLAT, label: 'Back', field: 'BACK_FLAT' });
        }
    }

    if (!colorSpecific || (product.SIDE_MODEL && product.COLOR_NAME === selectedColor?.COLOR_NAME)) {
        if (product.SIDE_MODEL) {
            images.push({ url: product.SIDE_MODEL, label: 'Side', field: 'SIDE_MODEL' });
        }
    }


    // Set main image
    const mainImageUrl = images[0]?.url || null;
    if (mainImageUrl) {
        const img = document.getElementById('productImage');
        const placeholder = document.getElementById('imagePlaceholder');

        img.src = mainImageUrl;
        img.style.display = 'block';
        placeholder.style.display = 'none';

        // Handle image load error
        img.onerror = () => {
            img.style.display = 'none';
            placeholder.style.display = 'flex';
        };

        img.onload = () => {
        };

        // Create thumbnails if we have multiple images
        if (images.length > 1) {
            createImageThumbnails(images);
        }
    }
}

// Create image thumbnails for multiple views
function createImageThumbnails(images) {
    const thumbnailsContainer = document.getElementById('imageThumbnails');
    thumbnailsContainer.innerHTML = '';

    images.forEach((image, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'image-thumbnail';
        if (index === 0) thumbnail.classList.add('active');

        const img = document.createElement('img');
        img.src = image.url;
        img.alt = image.label;
        img.title = image.label;

        thumbnail.appendChild(img);

        // Add click handler
        thumbnail.addEventListener('click', () => {
            // Update main image
            const mainImg = document.getElementById('productImage');
            mainImg.src = image.url;

            // Update active thumbnail
            document.querySelectorAll('.image-thumbnail').forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');

        });

        thumbnailsContainer.appendChild(thumbnail);
    });

    thumbnailsContainer.style.display = 'flex';
}

// Load colors and images
async function loadColors(styleNumber) {
    const response = await fetch(`${EMB_API_BASE}/api/color-swatches?styleNumber=${styleNumber}`);
    if (!response.ok) throw new Error('Unable to load product colors. Please refresh or try again later.');
    const colorsArray = await response.json();
    const colors = Array.isArray(colorsArray) ? colorsArray : [];
    currentColors = colors;
    if (colors.length > 0) {
        selectedColor = colors[0];
        updateSelectedColor(selectedColor);
        if (colors.length > 1) displayColorSwatches(colors);
    }
}

// Display color swatches
function displayColorSwatches(colors) {
    const swatchesContainer = document.getElementById('colorSwatches');
    const swatchesSection = document.getElementById('colorSwatchesSection');

    swatchesContainer.innerHTML = '';

    colors.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        if (index === 0) swatch.classList.add('active');

        swatch.innerHTML = `<img src="${color.COLOR_SQUARE_IMAGE || color.swatchUrl}" alt="${color.COLOR_NAME || color.color}">`;
        swatch.title = color.COLOR_NAME || color.color;

        swatch.addEventListener('click', () => {
            // Remove active class from all swatches
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');

            // Update selected color
            selectedColor = color;
            updateSelectedColor(color);
        });

        swatchesContainer.appendChild(swatch);
    });

    swatchesSection.style.display = 'block';
}

// Load size pricing for upcharges
async function loadSizePricing(styleNumber) {
    window.currentSizePricing = null;
    const response = await fetch(`${EMB_API_BASE}/api/size-pricing?styleNumber=${styleNumber}`);
    if (!response.ok) throw new Error('Unable to load size pricing. Please refresh or try again later.');
    const sizePricing = await response.json();
    if (!Array.isArray(sizePricing) || !sizePricing.length || !sizePricing[0]) {
        throw new Error('Size pricing is unavailable for this product. Please try another style or contact support.');
    }
    window.currentSizePricing = sizePricing[0];
}

// Update selected color
function updateSelectedColor(color) {

    const colorName = color.COLOR_NAME || color.color || 'Natural';
    document.getElementById('currentColor').textContent = colorName;

    // Find matching product image from product-details data based on color
    updateMainImageForColor(colorName);

    // Load warehouse inventory for this color
    if (typeof loadCalculatorInventory === 'function' && currentProduct) {
        loadCalculatorInventory(currentProduct.STYLE, color.CATALOG_COLOR || colorName, colorName, color.COLOR_SQUARE_IMAGE || color.swatchUrl);
    }
}

// Update main product image for selected color
function updateMainImageForColor(colorName) {

    // Find matching product from original product data that has the same color and has image
    const productResponse = fetch(`${EMB_API_BASE}/api/product-details?styleNumber=${currentProduct.STYLE}`)
        .then(response => response.json())
        .then(productArray => {
            // Find ALL product entries that match this specific color
            const matchingProducts = productArray.filter(p => p.COLOR_NAME === colorName);

            if (matchingProducts.length > 0) {
                // Merge all image fields from products with this color
                const mergedProduct = { ...matchingProducts[0] };

                // Collect all unique image URLs from this color's variants
                matchingProducts.forEach(p => {
                    if (p.FRONT_MODEL && !mergedProduct.FRONT_MODEL) mergedProduct.FRONT_MODEL = p.FRONT_MODEL;
                    if (p.FRONT_FLAT && !mergedProduct.FRONT_FLAT) mergedProduct.FRONT_FLAT = p.FRONT_FLAT;
                    if (p.PRODUCT_IMAGE && !mergedProduct.PRODUCT_IMAGE) mergedProduct.PRODUCT_IMAGE = p.PRODUCT_IMAGE;
                    if (p.BACK_FLAT && !mergedProduct.BACK_FLAT) mergedProduct.BACK_FLAT = p.BACK_FLAT;
                    if (p.SIDE_MODEL && !mergedProduct.SIDE_MODEL) mergedProduct.SIDE_MODEL = p.SIDE_MODEL;
                });

                // Update with all images for this specific color only
                setMainProductImage(mergedProduct, true);
            } else {
                // Use the original default image
                setMainProductImage(currentProduct, false);
            }
        })
        .catch(error => {
            // Fall back to original image
            setMainProductImage(currentProduct, false);
        });
}

// Update pricing table with multiple size rows — columns are the API tiers (see apiTiersFrom)
function updatePricing(pricingData) {

    const tiers = apiTiersFrom(pricingData);
    if (!tiers.length) {
        console.error('❌ Invalid pricing data - no tiers');
        showApiError('Pricing data is incomplete. Please contact support at 253-922-5793.');
        return;
    }

    // Get sizes with sortOrder from API data for determining base size
    const sizesWithOrder = pricingData.apiData?.sizes || [];
    const displayAddOns = pricingData.apiData?.sellingPriceDisplayAddOns || {};

    // Find the base size - the size with the lowest upcharge (or zero upcharge)
    // For standard products, this will be S/M/L/XL with zero upcharge
    // For tall-only products, this will be the size with the minimum upcharge (e.g., LT)
    let firstBaseSize = sizesWithOrder.find(s => !displayAddOns[s.size] || displayAddOns[s.size] === 0);
    if (!firstBaseSize && sizesWithOrder.length > 0) {
        const minUp = Math.min(...sizesWithOrder.map(s => displayAddOns[s.size] || 0));
        firstBaseSize = sizesWithOrder.find(s => (displayAddOns[s.size] || 0) === minUp);
    }
    const baseSizeToUse = firstBaseSize ? firstBaseSize.size : sizesWithOrder[0]?.size || 'S';

    // Base price per tier label. The service returns prices in two formats:
    // pricingData.pricing[tierLabel][size] or pricingData.prices[size][tierLabel]
    const priceFor = (label, size) => {
        if (pricingData.pricing && pricingData.pricing[label]) {
            const tierPrices = pricingData.pricing[label];
            const v = tierPrices[size];
            return typeof v === 'number' && v > 0 ? v : null;
        }
        if (pricingData.prices && pricingData.prices[size]) {
            const v = pricingData.prices[size][label];
            return typeof v === 'number' && v > 0 ? v : null;
        }
        return null;
    };
    const basePriceFor = (label) => {
        if (pricingData.pricing && pricingData.pricing[label]) {
            const tp = pricingData.pricing[label];
            return tp[baseSizeToUse] || tp['S'] || tp['SM'] || tp['OSFA'] || Object.values(tp).find(v => typeof v === 'number' && v > 0) || null;
        }
        return priceFor(label, baseSizeToUse);
    };
    const basePrices = {};
    tiers.forEach(t => { basePrices[t.TierLabel] = basePriceFor(t.TierLabel); });

    const pricingTable = document.querySelector('.pricing-table:not(.additional-logo-table)');
    const tbody = pricingTable.querySelector('tbody');

    // Every non-LTM tier must price (the small-order tier may be absent from older API responses)
    const missing = tiers.filter(t => t.LTM_Fee === 0 && !basePrices[t.TierLabel]);
    if (missing.length) {
        console.error('❌ Invalid pricing data - missing base prices for', missing.map(t => t.TierLabel));
        showApiError('Pricing data is incomplete. Please contact support at 253-922-5793.');
        tbody.innerHTML = `
            <tr>
                <td colspan="${tiers.length + 1}">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    Pricing currently unavailable. Please contact sales for a quote.
                </td>
            </tr>
        `;
        return;
    }

    renderTierHead(pricingTable, tiers, 'Size Range');
    renderSmallOrderCopy(tiers, 'pieces');

    // Sort by sortOrder
    const sortedSizes = [...sizesWithOrder].sort((a, b) => a.sortOrder - b.sortOrder);
    tbody.innerHTML = '';

    // Base sizes = zero upcharge (or the lowest upcharge for tall-only products)
    const minUpcharge = Math.min(...sortedSizes.map(s => displayAddOns[s.size] || 0));
    let baseSizes = sortedSizes.filter(s => !displayAddOns[s.size] || displayAddOns[s.size] === 0);
    if (baseSizes.length === 0 && sortedSizes.length > 0) baseSizes = sortedSizes.filter(s => (displayAddOns[s.size] || 0) === minUpcharge);
    const baseSizeNames = baseSizes.map(s => s.size);
    const baseSizeDisplay = baseSizeNames.length > 0 ? baseSizeNames.join(', ') : sortedSizes[0]?.size || 'N/A';

    const cell = (t, price) => t.LTM_Fee > 0
        ? `<td class="price-cell ltm-column" data-base-price="${price || ''}">${price ? '$' + price.toFixed(2) : '-'}</td>`
        : `<td class="price-cell">${price ? '$' + price.toFixed(2) : '-'}</td>`;

    // Base sizes row
    const baseRow = document.createElement('tr');
    baseRow.innerHTML = `<td class="size-cell">${baseSizeDisplay}</td>` + tiers.map(t => cell(t, basePrices[t.TierLabel])).join('');
    tbody.appendChild(baseRow);

    // Extended sizes (upcharge above the base) in sorted order
    const extendedSizes = sortedSizes.filter(s => displayAddOns[s.size] > minUpcharge);
    extendedSizes.forEach(sizeData => {
        const size = sizeData.size;
        const relativeUpcharge = (displayAddOns[size] || 0) - minUpcharge;
        if (relativeUpcharge <= 0) return;
        const row = document.createElement('tr');
        row.innerHTML = `<td class="size-cell">${size}</td>` + tiers.map(t => {
            const exact = priceFor(t.TierLabel, size);
            const price = exact || (basePrices[t.TierLabel] ? basePrices[t.TierLabel] + relativeUpcharge : null);
            return cell(t, price);
        }).join('');
        tbody.appendChild(row);
    });

}

// ==================== API-DRIVEN TIER COLUMNS (2026-09-06) ====================
// Erik's rule: every range a customer reads is pricing. The table columns used to be typed
// (1-7 / 8-23 / 24-47 / 48-71 / 72+) while the prices came from the API tiers — a Caspio re-cut
// would have priced right under wrong headers. Now the tiers drive the headers, the LTM column
// and the per-tier cells.
function apiTiersFrom(source) {
    const raw = (source && (source.tierData || (source.apiData && source.apiData.tiersR) || source.tiersR)) || [];
    return (Array.isArray(raw) ? raw : Object.values(raw))
        .filter(t => t && Number.isFinite(Number(t.MinQuantity)))
        .map(t => ({ ...t, MinQuantity: Number(t.MinQuantity), MaxQuantity: Number(t.MaxQuantity), LTM_Fee: parseFloat(t.LTM_Fee) || 0 }))
        .sort((a, b) => a.MinQuantity - b.MinQuantity);
}
function tierHeaderText(t) { return (t.MaxQuantity >= 99999 || /\+$/.test(String(t.TierLabel))) ? `${t.MinQuantity}+ pieces` : `${t.MinQuantity}-${t.MaxQuantity} pieces`; }
function renderTierHead(table, tiers, firstHeader) {
    const thead = table && table.querySelector('thead');
    if (!thead || !tiers.length) return;
    thead.innerHTML = '<tr><th>' + firstHeader + '</th>' + tiers.map(t =>
        `<th${t.LTM_Fee > 0 ? ' class="ltm-column"' : ''} data-tier="${t.TierLabel}">${tierHeaderText(t)}</th>`).join('') + '</tr>';
}
function renderSmallOrderCopy(tiers, unitWord) {
    const ltm = tiers.find(t => t.LTM_Fee > 0);
    if (!ltm) return;
    const span = document.querySelector('#ltmCalculator h4 span');
    if (span) span.textContent = `(${ltm.MinQuantity}-${ltm.MaxQuantity} ${unitWord})`;
    document.querySelectorAll('.pricing-note').forEach(p => { p.textContent = `*${ltm.MinQuantity}-${ltm.MaxQuantity} piece prices vary by quantity selected below`; });
}

// Show loading state
function showLoading() {
    loadingState.style.display = 'flex';
    productHero.style.display = 'none';
    pricingSection.style.display = 'none';
    orderInfoSection.style.display = 'none';
    hideApiError();
}

// Show product sections
function showProduct() {
    loadingState.style.display = 'none';
    productHero.style.display = 'block';
    pricingSection.style.display = 'block';
    orderInfoSection.style.display = 'block';
    hideApiError();
}

// Show API error notification
function showApiError(message) {
    const errorNotification = document.getElementById('apiErrorNotification');
    const errorMessage = document.getElementById('errorMessage');

    if (errorNotification && errorMessage) {
        errorMessage.textContent = message || 'Unable to load pricing data. Please try again later or contact support at 253-922-5793.';
        errorNotification.style.display = 'flex';
    }
}

// Hide API error notification
function hideApiError() {
    const errorNotification = document.getElementById('apiErrorNotification');
    if (errorNotification) {
        errorNotification.style.display = 'none';
    }
}

// Show no product state
function showNoProduct() {
    loadingState.style.display = 'none';

    // Update loading text to show no product
    document.querySelector('.loading p').textContent = 'No product selected. Please search for a product style number above.';
    document.querySelector('.loading i').className = 'fas fa-search';
    loadingState.style.display = 'flex';

    productHero.style.display = 'none';
    pricingSection.style.display = 'none';
    orderInfoSection.style.display = 'none';
}

// ============================================
// LTM Quantity Picker — updates 1-7 column prices
// ============================================

// Initialize LTM calculator when page loads
function initLTMCalculator() {
    const qtySelect = document.getElementById('ltmQuantity');

    if (qtySelect) {
        qtySelect.addEventListener('change', updateLTMCalculator);
    }
}

// Live LTM fee from Caspio (Pricing_Tiers.LTM_Fee on the small-order row).
// null until pricing loads, or if the API didn't carry it.
let _ltmFeeLive = null;

// Fallback ONLY — Erik's rule: a hardcoded price is allowed only when the
// API is unreachable AND it surfaces a visible warning. Before 2026-08-17
// this page hardcoded 50 unconditionally, so changing the LTM fee in Caspio
// repriced every quote builder and left THIS page quoting the old number
// forever, silently, to reps.
const LTM_FEE_FALLBACK = 50;

// Update LTM pricing data from loaded pricing — stores base prices and triggers column update
function updateLTMPricingData(pricingData) {
    if (!pricingData || !pricingData.pricing) return;
    // The small-order row is the one carrying a non-zero LTM_Fee (tiers above
    // 1-7 have 0). Matching on the FEE rather than a '1-7' label keeps this
    // working if Erik ever relabels or re-bands the tier in Caspio.
    const tiers = pricingData.tierData || pricingData.apiData?.tiersR || [];
    const ltmTier = Array.isArray(tiers) ? tiers.find(t => Number(t?.LTM_Fee) > 0) : null;
    _ltmFeeLive = ltmTier ? Number(ltmTier.LTM_Fee) : null;
    updateLTMCalculator();
}

// Show/hide the estimate warning when the live fee wasn't available.
function renderLtmFeeWarning(isFallback, fee) {
    const host = document.querySelector('.ltm-input-section');
    if (!host) return;
    let el = document.getElementById('ltmFeeWarning');
    if (!isFallback) { if (el) el.remove(); return; }
    if (!el) {
        el = document.createElement('p');
        el.id = 'ltmFeeWarning';
        el.setAttribute('role', 'status');
        el.classList.add('core-fee-warning');
        host.appendChild(el);
    }
    el.textContent = `⚠ Small-order fee shown as an estimate ($${fee.toFixed(2)}) — live pricing didn't return it. Verify before quoting.`;
}

// Recalculate all 1-7 column cells based on selected quantity
function updateLTMCalculator() {
    const qty = parseInt(document.getElementById('ltmQuantity')?.value || 3);
    const isFallback = _ltmFeeLive == null;
    const ltmFee = isFallback ? LTM_FEE_FALLBACK : _ltmFeeLive;
    renderLtmFeeWarning(isFallback, ltmFee);
    const ltmPerUnit = ltmFee / qty;

    // Update the small-order column (the API tier carrying the LTM fee)
    const rows = document.querySelectorAll('.pricing-table:not(.additional-logo-table) tbody tr');
    rows.forEach(row => {
        const cell = row.querySelector('td.ltm-column');
        if (!cell) return;
        const basePrice = parseFloat(cell.dataset.basePrice);
        if (!isNaN(basePrice)) cell.textContent = '$' + (basePrice + ltmPerUnit).toFixed(2);
    });

    // Update column header to show qty context (label from the API tier)
    const header = document.querySelector('.pricing-table:not(.additional-logo-table) thead th.ltm-column');
    if (header) {
        const label = header.dataset.tier || header.textContent.replace(/\s*\(.*$/, '').replace(' pieces', '');
        header.textContent = label + ' pieces (' + qty + ' pcs)';
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', initLTMCalculator);
