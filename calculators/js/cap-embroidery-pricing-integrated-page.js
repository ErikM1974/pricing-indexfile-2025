/* cap-embroidery-pricing-integrated-page.js — the page script for /calculators/cap-embroidery-pricing-integrated.html, extracted 2026-09-06 from its inline <script>
 * (Rule 3). Kept at global scope on purpose: it was global before, and the shared calculator scripts call some
 * of these functions by name. Logging is gated (localhost or ?debug=1); console.error/warn stay live. */
var CAPEMB_LOG_ON = window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug');
var capembLog = CAPEMB_LOG_ON ? console.log.bind(console) : function () {};
// Proxy host from /config/app.config.js (Rule 6) — never guess a backend.
var CAPEMB_API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
if (!CAPEMB_API_BASE) console.error('[cap-embroidery-pricing-integrated] APP_CONFIG.API.BASE_URL missing — pricing cannot load');

// Initialize cap pricing service
const capService = new CapEmbroideryPricingService();

// State
let currentProduct = null;
let currentColors = [];
let selectedColor = null;
let currentSizes = [];
let pricingData = null;

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
        loadManualCapPricing(parseFloat(manualCost));
        setupSearch();
        return; // Skip normal product loading
    }

    // NORMAL FLOW: Get style from URL parameter
    const styleNumber = urlParams.get('StyleNumber') || urlParams.get('STYLE_No') || urlParams.get('style') || 'C112';

    loadCapProduct(styleNumber);
    setupSearch();
});

// Setup search functionality for caps only
function setupSearch() {
    const searchInput = document.getElementById('styleSearch');
    const searchBtn = document.getElementById('searchBtn');
    const searchWrapper = document.querySelector('.search-wrapper');

    // Create search results dropdown
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    searchWrapper.appendChild(resultsContainer);

    let searchTimeout = null;

    // Perform API search for caps only
    async function performAPISearch(query) {
        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            return;
        }

        // Show loading state
        resultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching caps...</div>';
        resultsContainer.classList.add('active');

        try {
            const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`);

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const results = await response.json();

            // Filter results into caps vs beanies/knit items
            const capResults = [];
            const beanieResults = [];

            results.forEach(item => {
                // Use shared utility for filtering
                if (ProductCategoryFilter.isFlatHeadwear(item)) {
                    beanieResults.push(item);
                } else if (ProductCategoryFilter.isStructuredCap(item)) {
                    capResults.push(item);
                }
            });

            // Build the results display
            if (capResults.length === 0 && beanieResults.length === 0) {
                resultsContainer.innerHTML = '<div class="search-no-results">No cap styles found</div>';
            } else {
                let resultsHTML = '';

                // Add message about beanies if any were found
                if (beanieResults.length > 0) {
                    resultsHTML += `
                        <div style="padding: 10px; background: #fef3c7; border-bottom: 1px solid #fbbf24; color: #92400e; font-size: 13px;">
                            <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
                            Found ${beanieResults.length} beanie/knit item(s). Please use the <a href="/pricing/embroidery" style="color: #4cb354; font-weight: 600;">Flat Embroidery Pricing</a> page for beanies and knit caps.
                        </div>
                    `;
                }

                // Add cap results
                if (capResults.length > 0) {
                    resultsHTML += capResults.map(result => {
                        return `
                            <div class="search-result-item" data-style="${result.value}">
                                <div class="search-result-info">
                                    <div class="search-result-style">Style #${result.value}</div>
                                    <div class="search-result-name">${result.label}</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else if (beanieResults.length > 0) {
                    // Only beanies were found, no caps
                    resultsHTML += '<div class="search-no-results">No cap styles found. See message above for beanie/knit options.</div>';
                }

                resultsContainer.innerHTML = resultsHTML;

                // Add click handlers to cap results only
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

    // Handle input changes with debouncing
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performAPISearch(e.target.value.trim());
        }, 300);
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

// Load cap product data
async function loadCapProduct(styleNumber) {

    try {
        showLoading();

        // Fetch product details
        const productResponse = await fetch(`${CAPEMB_API_BASE}/api/product-details?styleNumber=${styleNumber}`);
        if (!productResponse.ok) {
            if (productResponse.status === 404) {
                throw new Error(`Cap style "${styleNumber}" not found. Please check the style number and try again.`);
            } else if (productResponse.status >= 500) {
                throw new Error('Pricing server is temporarily unavailable. Please try again in a few moments.');
            } else {
                throw new Error(`Unable to load product details (Error ${productResponse.status}). Please contact support.`);
            }
        }

        const productArray = await productResponse.json();

        if (!productArray || productArray.length === 0) {
            throw new Error(`No product information found for style "${styleNumber}". This may not be a valid cap style.`);
        }

        currentProduct = productArray[0];

        // Validate that this is actually a cap product
        const productTitle = (currentProduct.PRODUCT_TITLE || currentProduct.ProductTitle || '').toLowerCase();
        const productDescription = (currentProduct.PRODUCT_DESCRIPTION || currentProduct.Description || '').toLowerCase();
        const category = (currentProduct.CATEGORY || currentProduct.Category || '').toLowerCase();
        const brand = currentProduct.BRAND_NAME || currentProduct.BRAND || currentProduct.Brand || '';

        // Use shared utility for filtering
        if (ProductCategoryFilter.isFlatHeadwear(currentProduct)) {
            showProductMismatchOverlay(
                styleNumber,
                `${brand} ${currentProduct.PRODUCT_TITLE || currentProduct.ProductTitle || styleNumber}`,
                'This is a flat headwear item that requires flat embroidery, not cap embroidery.'
            );
            return; // Stop loading the rest of the page
        }

        if (!ProductCategoryFilter.isStructuredCap(currentProduct)) {
            // This is not a cap - likely a shirt or other item
            showProductMismatchOverlay(
                styleNumber,
                `${brand} ${currentProduct.PRODUCT_TITLE || currentProduct.ProductTitle || styleNumber}`,
                'This product requires flat embroidery pricing, not cap embroidery.'
            );
            return; // Stop loading the rest of the page
        }

        // Update product info
        updateProductInfo(currentProduct, styleNumber);

        // Set initial main product image
        setMainProductImage(currentProduct);

        // Load colors and images
        await loadColors(styleNumber);

        // Load available sizes from API
        await loadSizes(styleNumber);

        // Load cap pricing data
        try {
            pricingData = await capService.fetchPricingData(styleNumber);

            if (!pricingData || !pricingData.pricing) {
                throw new Error('Pricing structure is invalid');
            }
        } catch (pricingError) {
            console.error('❌ Pricing data error:', pricingError);
            throw new Error('Unable to load embroidery pricing. The pricing service may be temporarily unavailable. Please try again or contact support at 253-922-5793.');
        }

        // Calculate and display cap prices
        updateCapPricing();

        // Update LTM calculator with real pricing
        updateLTMCapPricing();

        // Update breadcrumb
        const productsBreadcrumb = document.getElementById('products-breadcrumb');
        if (productsBreadcrumb) {
            productsBreadcrumb.href = `/product.html?style=${styleNumber}`;
        }

        // Show all sections
        showProduct();

    } catch (error) {
        console.error('❌ Error loading cap:', error);
        showApiError(error.message || 'Failed to load cap pricing. Please try again later or contact support at 253-922-5793.');
        showNoProduct();
    }
}

// Load manual cap pricing (when ?manualCost parameter is provided)
async function loadManualCapPricing(manualCost) {

    try {
        showLoading();

        // Use the service's manual data generation
        pricingData = await capService.generateManualPricingData(manualCost);

        // Update product info for manual mode
        const manualProduct = {
            PRODUCT_TITLE: 'Manual Cap Pricing Mode',
            BRAND_NAME: 'Manual Entry',
            PRODUCT_DESCRIPTION: `Base cost: $${manualCost.toFixed(2)} - No product images available in manual mode`
        };

        currentProduct = manualProduct;
        updateProductInfo(manualProduct, 'MANUAL');

        // Hide product image
        const productImage = document.querySelector('.product-image-main');
        if (productImage) productImage.style.display = 'none';

        // Set sizes to OSFA (One Size Fits All)
        currentSizes = [{ size: 'OSFA', available: true }];

        // Update pricing display
        updateCapPricing();

        // Update LTM calculator with real pricing
        updateLTMCapPricing();

        // Show product sections
        showProduct();


    } catch (error) {
        console.error('❌ Error loading manual cap pricing:', error);
        showApiError('Failed to load manual pricing mode');
        showNoProduct();
    }
}

// Load available sizes from API
async function loadSizes(styleNumber) {

    try {
        const sizePricingResponse = await fetch(`${CAPEMB_API_BASE}/api/size-pricing?styleNumber=${styleNumber}`);

        if (sizePricingResponse.ok) {
            const sizePricingArray = await sizePricingResponse.json();

            if (sizePricingArray && sizePricingArray.length > 0) {
                // Extract unique sizes from all color variants
                const allSizes = new Set();
                const sizeUpcharges = {};
                let baseCapPrice = null;

                sizePricingArray.forEach(colorData => {
                    if (colorData.basePrices) {
                        Object.keys(colorData.basePrices).forEach(size => {
                            allSizes.add(size);
                            // Store the first non-null base price we find
                            if (baseCapPrice === null && colorData.basePrices[size]) {
                                baseCapPrice = colorData.basePrices[size];
                            }
                        });
                    }
                    // Collect upcharges
                    if (colorData.sizeUpcharges) {
                        Object.assign(sizeUpcharges, colorData.sizeUpcharges);
                    }
                });

                currentSizes = Array.from(allSizes);
                window.currentSizeUpcharges = sizeUpcharges;

                // Store the base cap price from size-pricing API (this is the correct source)
                if (baseCapPrice !== null) {
                    window.baseCapPriceFromSizeAPI = baseCapPrice;
                }

            }
        } else {
            // Default to OSFA for caps
            currentSizes = ['OSFA'];
            window.currentSizeUpcharges = {};
            window.baseCapPriceFromSizeAPI = null;
        }
    } catch (error) {
        // Default to OSFA for caps
        currentSizes = ['OSFA'];
        window.currentSizeUpcharges = {};
        window.baseCapPriceFromSizeAPI = null;
    }
}

// Round cap price using API rounding method (matches pricing engine's roundCapPrice)
function roundCapPrice(price) {
    if (isNaN(price)) return null;
    const method = pricingData?.apiData?.rulesR?.RoundingMethod;
    if (method === 'CeilDollar') return Math.ceil(price);
    // Default: HalfDollarUp — round UP to nearest $0.50
    if (price % 0.5 === 0) return price;
    return Math.ceil(price * 2) / 2;
}

// Calculate cap pricing using the same formula as cap-quote-pricing.js
function calculateCapPrice(baseCapPrice, quantity, sizeUpcharge = 0) {

    // Get margin from API data — Caspio Pricing_Tiers is authoritative (0.53 as of 2026-06)
    const tier = getTierForQuantity(quantity);
    let marginDenominator = 0.53; // last-resort fallback only
    if (pricingData && pricingData.apiData && pricingData.apiData.tiersR) {
        const tierData = pricingData.apiData.tiersR.find(t => t.TierLabel === tier);
        if (tierData && tierData.MarginDenominator) {
            marginDenominator = tierData.MarginDenominator;
        }
    }
    const capSellingPrice = baseCapPrice / marginDenominator;

    // Get embroidery price for the tier and 8000 stitches
    const embroideryPrice = getEmbroideryPriceForTier(tier);

    // Calculate decorated price
    const decoratedPrice = capSellingPrice + embroideryPrice;

    // Round using API-driven method (HalfDollarUp default, matching pricing engine)
    let finalPrice = roundCapPrice(decoratedPrice);

    // Note: LTM fee is only for orders of 7 or fewer pieces
    // We don't show that in the regular pricing table

    // Add size upcharge if any
    if (sizeUpcharge > 0) {
        finalPrice += sizeUpcharge;
        finalPrice = roundCapPrice(finalPrice);
    }

    return finalPrice;
}

// Get tier for quantity
function getTierForQuantity(quantity) {
    if (quantity >= 72) return '72+';
    if (quantity >= 48) return '48-71';
    if (quantity >= 24) return '24-47';
    if (quantity >= 8) return '8-23';
    return '1-7';
}

// Get embroidery price for tier (8000 stitches, no extra stitches)
function getEmbroideryPriceForTier(tier) {
    if (!pricingData || !pricingData.apiData || !pricingData.apiData.allEmbroideryCostsR) {
        console.error('❌ No embroidery cost data available from API');
        // NO FALLBACKS - must have API data for accurate pricing
        showApiError('Embroidery pricing data unavailable. Please refresh the page or contact support.');
        return 0; // Return 0 to prevent calculation with bad data
    }

    // Find the embroidery data for this tier with 8000 stitch count
    const embroideryData = pricingData.apiData.allEmbroideryCostsR.find(e =>
        e.TierLabel === tier && e.StitchCount === 8000
    );

    if (embroideryData) {
        return parseFloat(embroideryData.EmbroideryCost);
    }

    // If no 8000 stitch data, try without stitch count filter (backward compatibility)
    const embroideryDataAny = pricingData.apiData.allEmbroideryCostsR.find(e =>
        e.TierLabel === tier
    );

    if (embroideryDataAny) {
        return parseFloat(embroideryDataAny.EmbroideryCost);
    }

    // For 1-7 and 8-23 tiers, fall back to 24-47 tier price (same embroidery cost, different quantity breaks)
    // This handles backward compatibility when API doesn't have new tier data yet
    if (tier === '1-7' || tier === '8-23') {
        return getEmbroideryPriceForTier('24-47');
    }

    // NO FALLBACKS for other tiers - API data is required for accurate pricing
    console.error(`❌ No embroidery cost found for tier ${tier} in API data`);
    showApiError(`No embroidery pricing available for tier ${tier}. Please contact support.`);
    return 0; // Return 0 to prevent calculation with bad data
}

// Update cap pricing table
function updateCapPricing() {

    const tbody = document.querySelector('.pricing-table tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Get base cap price - prioritize size-pricing API data (matches quote builder)
    let baseCapPrice = 15; // Default fallback

    // First priority: Use the price from size-pricing API (this matches the quote builder)
    if (window.baseCapPriceFromSizeAPI) {
        baseCapPrice = window.baseCapPriceFromSizeAPI;
    } 
    // Second priority: Use standardGarmentBaseCostUsed from bundle
    else if (pricingData && pricingData.standardGarmentBaseCostUsed) {
        baseCapPrice = pricingData.standardGarmentBaseCostUsed;
    } 
    // Last resort: Use sizes from bundle data
    else if (pricingData && pricingData.apiData && pricingData.apiData.sizes && pricingData.apiData.sizes.length > 0) {
        const firstSize = pricingData.apiData.sizes[0];
        if (firstSize) {
            baseCapPrice = firstSize.price || firstSize.maxCasePrice || 15;
        }
    }


    // Generate rows for each size
    currentSizes.forEach(size => {
        const row = document.createElement('tr');

        // Get upcharge for this size
        const upcharge = window.currentSizeUpcharges?.[size] || 0;

        // Calculate prices for each tier (all 5 tiers)
        const price1_7 = calculateCapPrice(baseCapPrice, 1, upcharge);
        const price8_23 = calculateCapPrice(baseCapPrice, 8, upcharge);
        const price24 = calculateCapPrice(baseCapPrice, 24, upcharge);
        const price48 = calculateCapPrice(baseCapPrice, 48, upcharge);
        const price72 = calculateCapPrice(baseCapPrice, 72, upcharge);

        // Build row HTML
        let sizeDisplay = size;
        if (upcharge > 0) {
            sizeDisplay += ` <span class="size-note">(+$${upcharge.toFixed(2)} upcharge)</span>`;
        }

        row.innerHTML = `
            <td>${sizeDisplay}</td>
            <td class="ltm-column" data-base-price="${price1_7}"><span class="price">$${price1_7.toFixed(2)}</span></td>
            <td><span class="price">$${price8_23.toFixed(2)}</span></td>
            <td><span class="price">$${price24.toFixed(2)}</span></td>
            <td><span class="price">$${price48.toFixed(2)}</span></td>
            <td><span class="price">$${price72.toFixed(2)}</span></td>
        `;

        tbody.appendChild(row);
    });

}

// Update product information
function updateProductInfo(product, styleNumber) {

    const title = product.PRODUCT_TITLE || product.ProductTitle || product.STYLE || styleNumber.toUpperCase();
    const description = product.PRODUCT_DESCRIPTION || product.Description || product.PRODUCT_TITLE || '';
    const brand = product.BRAND_NAME || product.BRAND || product.Brand || 'Unknown Brand';

    document.getElementById('productTitle').textContent = title;
    document.getElementById('productDescription').textContent = description;
    document.getElementById('currentStyle').textContent = `#${styleNumber.toUpperCase()}`;
    document.getElementById('currentBrand').textContent = brand;

}

// Helper function to detect generic catalog images
function isGenericProductImage(url) {
    if (!url) return true;

    // Check for generic catalog image patterns
    // These are typically: /catalog/images/[STYLE].jpg or similar
    const genericPatterns = [
        /\/catalog\/images\/[A-Z0-9]+\.jpg$/i,  // Matches /catalog/images/C112.jpg
        /\/catalog\/[A-Z0-9]+\.jpg$/i,          // Matches /catalog/C112.jpg
        /\/imglib\/mft\/[A-Z0-9]+\.jpg$/i       // Matches other generic patterns
    ];

    return genericPatterns.some(pattern => pattern.test(url));
}

// Set main product image and create thumbnails
function setMainProductImage(product, colorSpecific = false) {

    // Collect all available images
    const images = [];

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

    // Add back/side images if available for this color
    if (product.BACK_FLAT) {
        images.push({ url: product.BACK_FLAT, label: 'Back', field: 'BACK_FLAT' });
    }
    if (product.SIDE_MODEL) {
        images.push({ url: product.SIDE_MODEL, label: 'Side', field: 'SIDE_MODEL' });
    }


    if (images.length > 0) {
        // Set main image
        const mainImage = document.getElementById('productImage');
        const placeholder = document.getElementById('imagePlaceholder');

        mainImage.src = images[0].url;
        mainImage.style.display = 'block';
        placeholder.style.display = 'none';

        // Handle image load error
        mainImage.onerror = () => {
            mainImage.style.display = 'none';
            placeholder.style.display = 'flex';
        };

        mainImage.onload = () => {
        };

        // Create thumbnails if multiple images
        if (images.length > 1) {
            const thumbnailsContainer = document.getElementById('imageThumbnails');
            thumbnailsContainer.innerHTML = '';
            thumbnailsContainer.style.display = 'flex';

            images.forEach((img, index) => {
                const thumb = document.createElement('div');
                thumb.className = 'image-thumbnail' + (index === 0 ? ' active' : '');

                const thumbImg = document.createElement('img');
                thumbImg.src = img.url;
                thumbImg.alt = img.label;
                thumbImg.title = img.label;

                thumb.appendChild(thumbImg);

                thumb.onclick = () => {
                    // Update main image
                    mainImage.src = img.url;
                    // Update active thumbnail
                    document.querySelectorAll('.image-thumbnail').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                };

                thumbnailsContainer.appendChild(thumb);
            });

        } else {
            // Hide thumbnails if only one image
            const thumbnailsContainer = document.getElementById('imageThumbnails');
            if (thumbnailsContainer) {
                thumbnailsContainer.style.display = 'none';
            }
        }
    } else {
        document.getElementById('productImage').style.display = 'none';
        document.getElementById('imagePlaceholder').style.display = 'flex';
    }
}

// Load colors
async function loadColors(styleNumber) {

    try {
        const response = await fetch(`${CAPEMB_API_BASE}/api/color-swatches?styleNumber=${styleNumber}`);

        if (response.ok) {
            const colorsArray = await response.json();

            // API returns array directly
            const colors = Array.isArray(colorsArray) ? colorsArray : [];
            currentColors = colors;

            if (colors.length > 0) {
                // Set first color as selected
                selectedColor = colors[0];
                displayColorSwatches(colors);
            } else {
            }
        } else {
        }
    } catch (error) {
    }
}

// Display color swatches
function displayColorSwatches(colors) {
    const section = document.getElementById('colorSwatchesSection');
    const container = document.getElementById('colorSwatches');

    if (!colors || colors.length === 0) {
        return;
    }

    container.innerHTML = '';

    colors.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch' + (index === 0 ? ' active' : '');

        // Try COLOR_SQUARE_IMAGE first, then fall back to solid color
        if (color.COLOR_SQUARE_IMAGE || color.swatchUrl) {
            const img = document.createElement('img');
            img.src = color.COLOR_SQUARE_IMAGE || color.swatchUrl;
            img.alt = color.COLOR_NAME || color.color || 'Color swatch';
            img.onerror = function() {
                // If image fails to load, use solid color fallback
                swatch.innerHTML = '';
                swatch.style.background = color.HEX_CODE || color.hexCode || '#cccccc';
            };
            swatch.appendChild(img);
        } else if (color.HEX_CODE || color.hexCode) {
            // Use hex code if no image available
            swatch.style.background = color.HEX_CODE || color.hexCode;
        } else {
            // Default gray if no color data
            swatch.style.background = '#cccccc';
        }

        swatch.title = color.COLOR_NAME || color.color || 'Unknown Color';
        swatch.onclick = () => {
            // Update active swatch
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            // Update current color display
            const colorName = color.COLOR_NAME || color.color || 'Unknown';
            document.getElementById('currentColor').textContent = colorName;
            selectedColor = color;

            // Update main product image for selected color
            updateMainImageForColor(colorName);

        };

        container.appendChild(swatch);
    });

    // Show the color swatches section if we have any colors
    if (colors.length > 0) {
        section.style.display = 'block';
    }

    // Set initial color
    if (colors.length > 0) {
        selectedColor = colors[0];
        const initialColorName = colors[0].COLOR_NAME || colors[0].color || 'Unknown';
        document.getElementById('currentColor').textContent = initialColorName;
    }
}

// Update main product image for selected color
async function updateMainImageForColor(colorName) {

    if (!currentProduct || !currentProduct.STYLE) {
        return;
    }

    try {
        // Fetch product details to get color-specific images
        const response = await fetch(`${CAPEMB_API_BASE}/api/product-details?styleNumber=${currentProduct.STYLE}`);
        if (!response.ok) {
            return;
        }

        const productArray = await response.json();

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

            // Update product images with color-specific images
            setMainProductImage(mergedProduct, true);
        } else {
            // Keep the current images
        }
    } catch (error) {
        // Keep the current images
    }
}

// Show product mismatch overlay
function showProductMismatchOverlay(styleNumber, productName, reason) {

    // Hide loading state
    document.getElementById('loadingState').style.display = 'none';

    // Create or get overlay
    let overlay = document.getElementById('productMismatchOverlay');
    if (!overlay) {
        // Create the overlay HTML dynamically
        const overlayHTML = `
            <div id="productMismatchOverlay" class="product-mismatch-overlay">
                <div class="product-mismatch-modal">
                    <div class="product-mismatch-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 class="product-mismatch-title">Wrong Pricing Calculator</h2>
                    <p class="product-mismatch-message" id="mismatchMessage"></p>
                    <a id="redirectButton" href="#" class="product-mismatch-button">
                        Go to Flat Embroidery Pricing →
                    </a>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        overlay = document.getElementById('productMismatchOverlay');
    }

    // Update message and button
    document.getElementById('mismatchMessage').innerHTML = `
        <strong>${productName}</strong><br><br>
        ${reason}<br><br>
        Cap embroidery pricing is only for structured caps like baseball caps and trucker hats.
    `;

    document.getElementById('redirectButton').href = `/pricing/embroidery?StyleNumber=${styleNumber}`;

    // Show the overlay
    overlay.style.display = 'flex';

    // Gray out the background content (they might be partially visible)
    if (document.getElementById('productHero')) {
        document.getElementById('productHero').style.opacity = '0.3';
    }
    if (document.getElementById('pricingSection')) {
        document.getElementById('pricingSection').style.opacity = '0.3';
    }
    if (document.getElementById('orderInfoSection')) {
        document.getElementById('orderInfoSection').style.opacity = '0.3';
    }
}

// Show/hide functions
function showLoading() {
    loadingState.style.display = 'flex';
    productHero.style.display = 'none';
    pricingSection.style.display = 'none';
    orderInfoSection.style.display = 'none';
}

function showProduct() {
    loadingState.style.display = 'none';
    productHero.style.display = 'block';
    pricingSection.style.display = 'block';
    orderInfoSection.style.display = 'block';
}

function showNoProduct() {
    loadingState.innerHTML = `
        <i class="fas fa-search"></i>
        <p>Search for a cap style to view pricing</p>
    `;
}

function showApiError(message) {
    const notification = document.getElementById('apiErrorNotification');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    notification.style.display = 'flex';
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

// Update LTM calculator with real cap pricing from the pricing table
function updateLTMCapPricing() {
    updateLTMCalculator();
}

// Recalculate all 1-7 column cells based on selected quantity
function updateLTMCalculator() {
    const qty = parseInt(document.getElementById('ltmQuantity')?.value || 3);
    const LTM_FEE = 50;
    const ltmPerUnit = LTM_FEE / qty;

    // Update main pricing table 1-7 column
    const rows = document.querySelectorAll('.pricing-table:not(.additional-logo-table) tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
            const cell = cells[1]; // 1-7 column is index 1
            const basePrice = parseFloat(cell.dataset.basePrice);
            if (!isNaN(basePrice)) {
                const allInPrice = basePrice + ltmPerUnit;
                const span = cell.querySelector('.price') || cell;
                span.textContent = '$' + allInPrice.toFixed(2);
            }
        }
    });

    // Update column header to show qty context
    const header = document.querySelector('.pricing-table:not(.additional-logo-table) thead th.ltm-column');
    if (header) header.textContent = '1-7 pieces (' + qty + ' pcs)';
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', initLTMCalculator);
