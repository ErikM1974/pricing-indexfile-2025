/* dtg-pricing-page.js — the page script for /calculators/dtg-pricing.html, extracted 2026-09-06 from its inline <script>
 * (Rule 3). Kept at global scope on purpose: it was global before, and the shared calculator scripts call some
 * of these functions by name. Logging is gated (localhost or ?debug=1); console.error/warn stay live. */
var DTG_LOG_ON = window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug');
var dtgLog = DTG_LOG_ON ? console.log.bind(console) : function () {};
// Proxy host from /config/app.config.js (Rule 6) — never guess a backend.
var DTG_API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
if (!DTG_API_BASE) console.error('[dtg-pricing] APP_CONFIG.API.BASE_URL missing — pricing cannot load');

// Visible failure without a modal dialog: an inline role=alert card at the top of the page content.
function dtgInlineAlert(message) {
    var host = document.querySelector('main') || document.body;
    var el = document.createElement('div');
    el.className = 'calc-inline-alert'; el.setAttribute('role', 'alert');
    el.textContent = message;
    host.insertAdjacentElement('afterbegin', el);
    el.scrollIntoView({ block: 'nearest' });
}
        // 🚀 NUCLEAR SOLUTION: Simple DTG Pricing - Following Cap Embroidery Pattern
        dtgLog('🎯 DTG Pricing Page - Simple Layout (Nuclear Solution)');

        // Shared pricing service instance — formula delegates here so rounding is consistent
        const dtgCalcHelper = new DTGPricingService();

        // State
        let currentProduct = null;
        let currentColors = [];
        let selectedColor = null;
        let pricingData = null;

        // DOM Elements
        const loadingState = document.getElementById('loadingState');
        const productHero = document.getElementById('productHero');
        const pricingSection = document.getElementById('pricingSection');

        // Load DTG Product Recommendations
        async function loadDTGRecommendations() {
            dtgLog('🌟 Loading DTG Product Recommendations');

            const recommendationsData = [
                // T-Shirts
                { style: 'PC54', name: 'Core Cotton Tee', type: 'tshirt', brand: 'Port & Company', salesData: '18,753+ units sold', rating: 5, bestColors: ['Jet Black', 'Dk Hthr Grey', 'Navy', 'White'] },
                { style: 'PC61', name: 'Essential Tee', type: 'tshirt', brand: 'Port & Company', salesData: '15,621+ units sold', rating: 5, bestColors: ['Jet Black', 'Navy', 'Athletic Heather'], warning: '⚠️ Avoid Red - causes staining' },
                { style: 'PC450', name: 'Fan Favorite Tee', type: 'tshirt', brand: 'Port & Company', salesData: '10,006+ units sold', rating: 5, bestColors: ['Jet Black', 'Heather Navy', 'Dark Heather Grey'] },
                { style: 'PC55', name: 'Core Blend Tee', type: 'tshirt', brand: 'Port & Company', salesData: '7,892+ units sold', rating: 4, bestColors: ['Jet Black', 'Navy', 'Dark Heather Grey', 'White'] },
                { style: 'BC3001', name: 'Unisex Jersey Tee', type: 'tshirt', brand: 'BELLA+CANVAS', salesData: 'Premium soft feel', rating: 4, bestColors: ['Black', 'Navy', 'Dark Grey Heather'] },

                // Hoodies
                { style: 'PC78H', name: 'Core Fleece Pullover Hooded Sweatshirt', type: 'hoodie', brand: 'Port & Company', salesData: '5,234+ units sold', rating: 5, bestColors: ['Jet Black', 'Dark Heather Grey', 'Navy'] },
                { style: 'PC850H', name: 'Fan Favorite Fleece Pullover Hooded Sweatshirt', type: 'hoodie', brand: 'Port & Company', salesData: '3,891+ units sold', rating: 5, bestColors: ['Black', 'Dark Heather Grey', 'Team Navy'] }
            ];

            const container = document.getElementById('dtg-recommendations-grid');
            if (!container) return;

            container.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="spinner-border text-primary" role="status"><span class="sr-only">Loading recommendations...</span></div></div>';

            // Group products by type
            const tshirts = recommendationsData.filter(p => p.type === 'tshirt');
            const hoodies = recommendationsData.filter(p => p.type === 'hoodie');

            let cardsHTML = '';

            // Add T-Shirts section
            if (tshirts.length > 0) {
                cardsHTML += `
                    <div class="dtg-product-section">
                        <h4 class="dtg-section-title">
                            <i class="fas fa-tshirt"></i>
                            T-Shirts
                        </h4>
                        <div class="dtg-section-grid">
                `;

                for (const product of tshirts) {
                    cardsHTML += await generateProductCard(product);
                }

                cardsHTML += `
                        </div>
                    </div>
                `;
            }

            // Add Hoodies section
            if (hoodies.length > 0) {
                cardsHTML += `
                    <div class="dtg-product-section">
                        <h4 class="dtg-section-title">
                            <i class="fas fa-hoodie"></i>
                            Hoodies & Sweatshirts
                        </h4>
                        <div class="dtg-section-grid">
                `;

                for (const product of hoodies) {
                    cardsHTML += await generateProductCard(product);
                }

                cardsHTML += `
                        </div>
                    </div>
                `;
            }

            container.innerHTML = cardsHTML;
        }

        // Helper function to generate product card HTML
        async function generateProductCard(product) {
            try {
                // Try to fetch real product image from API - need to get exact match
                const response = await fetch(`${DTG_API_BASE}/api/products/search?q=${product.style}&limit=20`);
                let imageUrl = 'https://via.placeholder.com/300x300/f0f0f0/333?text=' + product.style;

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data.products && data.data.products.length > 0) {
                        // Find exact style match
                        let productData = data.data.products.find(p => p.styleNumber === product.style);

                        // If no exact match, use first result as fallback
                        if (!productData) {
                            productData = data.data.products[0];
                            dtgLog(`Warning: No exact match for ${product.style}, using ${productData.styleNumber}`);
                        }

                        // Use display image or model front image
                        imageUrl = productData.images?.display ||
                                  productData.images?.model?.front ||
                                  productData.images?.main ||
                                  imageUrl;
                    }
                }

                const stars = '★'.repeat(product.rating) + '☆'.repeat(5 - product.rating);

                return `
                    <div class="dtg-product-card" data-style="${product.style}">
                        <div class="dtg-card-badge">${product.rating === 5 ? '⭐ Top Seller' : '👍 Popular'}</div>
                        <div class="dtg-card-image">
                            <img src="${imageUrl}" alt="${product.name}" loading="lazy">
                        </div>
                        <div class="dtg-card-content">
                            <h4 class="dtg-card-title">${product.style}</h4>
                            <p class="dtg-card-subtitle">${product.name}</p>
                            <div class="dtg-card-rating">
                                <span class="stars">${stars}</span>
                            </div>
                            ${product.bestColors ? `
                                <div class="dtg-card-colors">
                                    <strong>Best Colors:</strong> ${product.bestColors.slice(0, 2).join(', ')}${product.bestColors.length > 2 ? '...' : ''}
                                </div>
                            ` : ''}
                            <button class="dtg-card-button" onclick="loadProductStyle('${product.style}')">
                                <i class="fas fa-arrow-right"></i> Load This Style
                            </button>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error(`Error loading product ${product.style}:`, error);
                return ''; // Return empty string on error
            }
        }

        // Function to load a specific product style
        function loadProductStyle(styleNumber) {
            dtgLog(`Loading style: ${styleNumber}`);
            // Direct navigation to the new product (use capital StyleNumber for consistency)
            window.location.href = `?StyleNumber=${styleNumber}`;
        }

        // Initialize page
        document.addEventListener('DOMContentLoaded', () => {
            dtgLog('🎯 DTG Pricing Page Initialized');

            // Get URL parameters
            const urlParams = new URLSearchParams(window.location.search);

            // CHECK FOR MANUAL COST OVERRIDE FIRST
            const manualCost = urlParams.get('manualCost') || urlParams.get('cost');

            if (manualCost && !isNaN(parseFloat(manualCost))) {
                dtgLog('🔧 MANUAL PRICING MODE - Base cost:', parseFloat(manualCost));
                loadManualDTGPricing(parseFloat(manualCost));
                setupSearch();
                initializeToggleUI();
                initializeUpchargeTooltip();
                return; // Skip normal product loading
            }

            // NORMAL FLOW: Get style from URL parameter (handle all case variations)
            const styleNumber = urlParams.get('styleNumber') ||
                               urlParams.get('StyleNumber') ||
                               urlParams.get('stylenumber') ||
                               urlParams.get('style') ||
                               urlParams.get('Style') ||
                               'PC61';

            loadDTGProduct(styleNumber);
            setupSearch();

            // Initialize toggle interface
            initializeToggleUI();

            // Initialize upcharge tooltip
            initializeUpchargeTooltip();

            // Load recommendations after page is ready
            setTimeout(() => {
                if (document.getElementById('dtg-recommendations-grid')) {
                    loadDTGRecommendations();
                }
            }, 1000);
        });

        // Fetch product details including brand name
        async function fetchProductDetails(styleNumber) {
            try {
                dtgLog('📋 Fetching product details for brand info...');
                const response = await fetch(`${DTG_API_BASE}/api/product-details?styleNumber=${styleNumber}`);

                if (!response.ok) {
                    console.warn('Could not fetch product details:', response.status);
                    return null;
                }

                const details = await response.json();
                dtgLog('✅ Product details received:', details);

                // Return the first item if it's an array, or the object itself
                return Array.isArray(details) && details.length > 0 ? details[0] : details;
            } catch (error) {
                console.warn('Error fetching product details:', error);
                return null;
            }
        }

        // Load DTG product data - SIMPLE VERSION
        async function loadDTGProduct(styleNumber) {
            dtgLog(`🎯 Loading DTG product: ${styleNumber}`);

            try {
                showLoading();

                // Update page title
                document.getElementById('productTitle').textContent = `DTG Pricing for ${styleNumber}`;
                document.getElementById('currentStyle').textContent = `#${styleNumber}`;

                // Load DTG pricing data and product details in parallel
                dtgLog('📡 Fetching DTG bundle data and product details...');
                const [bundleResponse, productDetails] = await Promise.all([
                    fetch(`${DTG_API_BASE}/api/dtg/product-bundle?styleNumber=${styleNumber}`),
                    fetchProductDetails(styleNumber)
                ]);

                if (!bundleResponse.ok) {
                    throw new Error(`DTG API failed: ${bundleResponse.status}`);
                }

                const data = await bundleResponse.json();
                dtgLog('📦 DTG Bundle received:', data);

                // Store data globally
                pricingData = data;

                // Merge product details with bundle data
                const completeProduct = {
                    ...(data.product || {}),
                    ...(productDetails || {}),
                    styleNumber: styleNumber
                };

                // Update product info with complete data including brand
                updateProductInfo(completeProduct, styleNumber);

                // Load size pricing from API for proper upcharge filtering
                if (window.UniversalPricingGrid && typeof window.UniversalPricingGrid.loadSizePricing === 'function') {
                    dtgLog('📊 Loading size pricing for upcharge display...');
                    window.UniversalPricingGrid.loadSizePricing(styleNumber);
                }


                // DEBUG: Log API structure to understand field names
                dtgLog('🔍 DEBUG - API Response Structure:');
                dtgLog('  - pricingData.pricing:', pricingData.pricing);
                dtgLog('  - pricingData.pricing.sizes:', pricingData.pricing?.sizes);
                dtgLog('  - pricingData.pricing.costs:', pricingData.pricing?.costs);
                dtgLog('  - pricingData.pricing.tiers:', pricingData.pricing?.tiers);
                if (pricingData.pricing?.sizes?.[0]) {
                    dtgLog('  - First size object:', pricingData.pricing.sizes[0]);
                    dtgLog('  - Available fields:', Object.keys(pricingData.pricing.sizes[0]));
                }
// REMOVED:                 // Generate DTG pricing table - DIRECT APPROACH
// REMOVED:                 updateDTGPricing();

                // Update tooltip with loaded data
                updateUpchargeTooltipContent();

                // Show all sections
                showProduct();

            } catch (error) {
                console.error('❌ Error loading DTG product:', error);
                showApiError(error.message || 'Failed to load DTG pricing. Please try again.');
                showNoProduct();
            }
        }

        // Load manual DTG pricing (when ?manualCost parameter is provided)
        async function loadManualDTGPricing(manualCost) {
            dtgLog(`🔧 Loading manual DTG pricing with base cost: $${manualCost.toFixed(2)}`);

            try {
                showLoading();

                // Fetch pricing bundle from API (same endpoint as DTGPricingService)
                dtgLog('📡 Fetching DTG pricing bundle from API...');
                const response = await fetch(DTG_API_BASE + '/api/pricing-bundle?method=DTG&styleNumber=PC61');

                if (!response.ok) {
                    throw new Error(`API failed: ${response.status}`);
                }

                const apiBundle = await response.json();
                dtgLog('📦 Manual pricing API bundle received:', {
                    totalTiers: apiBundle.tiersR?.length,
                    totalCosts: apiBundle.allDtgCostsR?.length,
                    lcCosts: apiBundle.allDtgCostsR?.filter(c => c.PrintLocationCode === 'LC')
                });

                // Build sizes array with manual cost (all sizes use the same manual cost)
                const manualSizes = [
                    { size: 'S', price: manualCost, sortOrder: 1 },
                    { size: 'M', price: manualCost, sortOrder: 2 },
                    { size: 'L', price: manualCost, sortOrder: 3 },
                    { size: 'XL', price: manualCost, sortOrder: 4 },
                    { size: '2XL', price: manualCost, sortOrder: 5 },
                    { size: '3XL', price: manualCost, sortOrder: 6 },
                    { size: '4XL', price: manualCost, sortOrder: 7 },
                    { size: '5XL', price: manualCost, sortOrder: 8 },
                    { size: '6XL', price: manualCost, sortOrder: 9 }
                ];

                // Create pricing data structure using API data + manual sizes
                const manualData = {
                    styleNumber: 'MANUAL',
                    product: {
                        styleNumber: 'MANUAL',
                        brand: 'Manual Entry',
                        description: 'Manual Pricing Mode',
                        image_url: ''
                    },
                    pricing: {
                        tiers: apiBundle.tiersR,                          // From API
                        costs: apiBundle.allDtgCostsR,                   // From API (tier-specific costs!)
                        upcharges: apiBundle.sellingPriceDisplayAddOns,   // From API
                        sizes: manualSizes,                               // Manual cost
                        locations: apiBundle.locations                    // From API
                    },
                    manualMode: true,
                    manualCost: manualCost
                };

                dtgLog('✅ Manual pricing data structure created:', {
                    totalCosts: manualData.pricing.costs?.length,
                    lcCosts: manualData.pricing.costs?.filter(c => c.PrintLocationCode === 'LC')?.length,
                    lcCostsDetails: manualData.pricing.costs?.filter(c => c.PrintLocationCode === 'LC')?.map(c => `${c.TierLabel}: $${c.PrintCost}`)
                });

                // Store data globally
                pricingData = manualData;

                // Update page title for manual mode
                document.getElementById('productTitle').textContent = `DTG Manual Pricing ($${manualCost.toFixed(2)} Base Cost)`;
                document.getElementById('currentStyle').textContent = `Manual Mode`;

                // Update product info section (show manual mode indicator)
                const productInfoSection = document.querySelector('.product-hero');
                if (productInfoSection) {
                    const brandElement = productInfoSection.querySelector('.product-brand');
                    const nameElement = productInfoSection.querySelector('.product-name');
                    const descElement = productInfoSection.querySelector('.product-description');

                    if (brandElement) brandElement.textContent = 'Manual Entry';
                    if (nameElement) nameElement.textContent = 'Non-Catalog Product';
                    if (descElement) descElement.textContent = `Base cost: $${manualCost.toFixed(2)} - No product images available in manual mode`;

                    // Hide image if present
                    const imageElement = productInfoSection.querySelector('.product-image-main');
                    if (imageElement) imageElement.style.display = 'none';
                }

                // Update tooltip with manual data
                updateUpchargeTooltipContent();

                // Show product sections
                showProduct();

                dtgLog('✅ Manual DTG pricing loaded successfully');

            } catch (error) {
                console.error('❌ Error loading manual DTG pricing:', error);
                showApiError('Failed to load manual pricing mode');
                showNoProduct();
            }
        }

        // Update DTG pricing table - DIRECT DOM MANIPULATION (Like Cap Embroidery)
        function updateDTGPricing() {
            dtgLog('💰 Updating DTG pricing table...');

            const tbody = document.getElementById('dtg-pricing-tbody');
            if (!tbody) {
                console.error('❌ Table tbody not found!');
                return;
            }

            // Clear existing rows - DIRECT APPROACH
            tbody.innerHTML = '';

            if (!pricingData || !pricingData.pricing) {
                console.error('❌ No pricing data available');
                tbody.innerHTML = '<tr><td colspan="4">No pricing data available</td></tr>';
                return;
            }

            // Define ALL locations including combos - don't rely on API for combo locations
            const allDTGLocations = [
                { code: 'LC', name: 'Left Chest' },
                { code: 'FF', name: 'Full Front' },
                { code: 'FB', name: 'Full Back' },
                { code: 'JF', name: 'Jumbo Front' },
                { code: 'JB', name: 'Jumbo Back' },
                { code: 'LC_FB', name: 'Left Chest + Full Back' },
                { code: 'LC_JB', name: 'Left Chest + Jumbo Back' },  // Common combo - small front, large back
                { code: 'FF_FB', name: 'Full Front + Full Back' },
                { code: 'JF_JB', name: 'Jumbo Front + Jumbo Back' }
            ];

            // Use our complete location list, not what API provides
            const locations = allDTGLocations;

            // Get tiers from API data - USE CORRECT TIERS
            const tiers = ['24-47', '48-71', '72+'];  // API confirmed these are the correct tiers

            dtgLog('📍 Locations:', locations);
            dtgLog('📊 Tiers:', tiers);

            // Initially show only primary locations (not combos)
            const primaryLocationCodes = ['LC', 'FF', 'FB', 'JF', 'JB'];  // All single locations
            const allLocations = locations;
            let showingAll = false;

            // Function to render locations
            function renderLocations(locsToShow) {
                tbody.innerHTML = '';
                locsToShow.forEach(location => {
                const row = document.createElement('tr');

                // Location name cell
                const locationCell = document.createElement('td');
                locationCell.className = 'location-cell';
                locationCell.textContent = location.name;
                row.appendChild(locationCell);

                // Price cells for each tier
                tiers.forEach(tier => {
                    const priceCell = document.createElement('td');
                    priceCell.className = 'price-cell';

                    // Get price from API data
                    const price = getDTGPrice(location.code, tier);
                    priceCell.textContent = `$${price.toFixed(2)}`;

                    row.appendChild(priceCell);
                });

                    tbody.appendChild(row);
                });
            }

            // Initially show single locations only (hide combos)
            const locsToShow = locations.filter(loc => !loc.code.includes('_'));
            renderLocations(locsToShow);

            // Add "Show All Locations" button
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'text-align: center; margin-top: 20px;';

            const showAllBtn = document.createElement('button');
            showAllBtn.textContent = 'Show Combo Locations';
            showAllBtn.style.cssText = `
                background: #4cb354;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            `;

            showAllBtn.addEventListener('click', () => {
                showingAll = !showingAll;
                if (showingAll) {
                    // Show ALL locations including combos
                    renderLocations(allLocations);
                    showAllBtn.textContent = 'Hide Combo Locations';
                } else {
                    // Show only single locations
                    const singleLocs = locations.filter(loc => !loc.code.includes('_'));
                    renderLocations(singleLocs);
                    showAllBtn.textContent = 'Show Combo Locations';
                }
            });

            showAllBtn.addEventListener('mouseenter', () => {
                showAllBtn.style.background = '#3a8d42';
                showAllBtn.style.transform = 'translateY(-2px)';
            });

            showAllBtn.addEventListener('mouseleave', () => {
                showAllBtn.style.background = '#4cb354';
                showAllBtn.style.transform = 'translateY(0)';
            });

            buttonContainer.appendChild(showAllBtn);

            // Add container for UniversalPricingGrid to display upcharges
            const upchargesSection = document.createElement('div');
            upchargesSection.className = 'upcharge-info';
            upchargesSection.style.cssText = `
                margin-top: 30px;
                padding: 20px;
                background: #f9fafb;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
            `;

            // Add a title before the UniversalPricingGrid content
            const upchargesTitle = document.createElement('h3');
            upchargesTitle.textContent = 'Size Upcharges';
            upchargesTitle.style.cssText = `
                font-size: 18px;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 15px;
            `;
            upchargesSection.appendChild(upchargesTitle);

            // The UniversalPricingGrid will populate the rest of the content
            // Set it as the container for the grid
            if (window.UniversalPricingGrid) {
                window.UniversalPricingGrid.upchargeContainer = upchargesSection;
                // Trigger an update if we already have data
                if (window.UniversalPricingGrid.availableSizes && window.UniversalPricingGrid.upcharges) {
                    window.UniversalPricingGrid.updateUpchargeDisplay();
                }
            }

            // Insert button and upcharges after the table
            const pricingSection = document.getElementById('pricingSection');
            pricingSection.appendChild(buttonContainer);
            pricingSection.appendChild(upchargesSection);

            dtgLog('✅ DTG pricing table updated with 3 tiers, Show All button, and size upcharges');
        }

        // Get DTG price for location and tier - API DATA REQUIRED (NO FALLBACKS)
        function getDTGPrice(locationCode, tierLabel) {
            // Validate API data is available
            if (!pricingData || !pricingData.pricing) {
                console.error('❌ API pricing data required but not available');
                throw new Error('Pricing data not loaded. Please refresh the page.');
            }

            // Map LTM tier (1-23) to actual API tier (24-47)
            // For quantities under 24, we use 24-47 tier pricing + $50 LTM fee
            const apiTierLabel = tierLabel === '1-23' ? '24-47' : tierLabel;

            // Check if it's a combo location
            const isCombo = locationCode.includes('_');

            // Get tier data for margin calculation using API tier label
            const tier = pricingData.pricing.tiers?.find(t => t.TierLabel === apiTierLabel);
            if (!tier) {
                console.error(`❌ Tier not found: ${apiTierLabel}`);
                throw new Error(`Tier data not available for ${apiTierLabel}`);
            }

            if (isCombo) {
                // For combo locations, calculate using API data
                return getDTGPriceForComboLocation(locationCode, apiTierLabel);
            }

            // Single location - calculate price using API data
            return getDTGPriceForSingleLocation(locationCode, apiTierLabel);
        }

        // Helper function for combo location pricing — delegates to shared service
        function getDTGPriceForComboLocation(locationCode, tierLabel) {
            return dtgCalcHelper.calculatePriceFromRawData(pricingData.pricing, locationCode, tierLabel);
        }

        // Helper function for single location pricing — delegates to shared service
        function getDTGPriceForSingleLocation(locationCode, tierLabel) {
            return dtgCalcHelper.calculatePriceFromRawData(pricingData.pricing, locationCode, tierLabel);
        }

        // ========================================
        // TOGGLE SWITCH PRICING INTERFACE
        // ========================================

        // State management for toggle interface
        const toggleState = {
            selectedLocations: [], // Array of selected location codes
            selectedTier: '24-47'   // Default tier
        };

        // Initialize toggle interface
        function initializeToggleUI() {
            dtgLog('🎚️ Initializing toggle interface...');

            // Set up location toggle event listeners - ENTIRE CARD CLICKABLE
            const locationToggles = document.querySelectorAll('.toggle-item');
            locationToggles.forEach(toggle => {
                const locationCode = toggle.dataset.location;

                // Make entire card clickable
                toggle.addEventListener('click', (e) => {
                    // Prevent double-firing if switch itself is clicked
                    e.stopPropagation();
                    toggleLocation(locationCode);
                });
            });

            // Set up tier button event listeners
            const tierButtons = document.querySelectorAll('.tier-button');
            tierButtons.forEach(button => {
                const tierLabel = button.dataset.tier;
                button.addEventListener('click', () => {
                    selectTier(tierLabel);
                });
            });

            // Set up LTM quantity input event listeners
            const ltmQuantityInput = document.getElementById('dtg-ltm-quantity-input');
            if (ltmQuantityInput) {
                // Real-time updates as user types
                ltmQuantityInput.addEventListener('input', handleLTMQuantityInput);

                // Validation when user leaves the field
                ltmQuantityInput.addEventListener('blur', validateLTMQuantityInput);

                dtgLog('✅ LTM quantity input listeners attached');
            }

            // Initialize with default tier selected
            updateLivePriceDisplay();

            dtgLog('✅ Toggle interface initialized');
        }

        // Initialize upcharge tooltip functionality
        function initializeUpchargeTooltip() {
            // Prevent duplicate initialization
            if (window.tooltipInitialized) {
                dtgLog('⚠️ Tooltip already initialized, skipping');
                return;
            }
            window.tooltipInitialized = true;

            const infoIcon = document.getElementById('upcharge-info-icon');
            const tooltip = document.getElementById('upcharge-tooltip');

            if (!infoIcon || !tooltip) {
                console.warn('⚠️ Tooltip elements not found');
                return;
            }

            dtgLog('✅ Initializing upcharge tooltip');

            // Desktop: Show on hover
            infoIcon.addEventListener('mouseenter', () => {
                if (window.innerWidth > 768) {
                    updateUpchargeTooltipContent();
                    tooltip.style.display = 'block';
                }
            });

            infoIcon.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    // Small delay to allow moving to tooltip
                    setTimeout(() => {
                        if (!tooltip.matches(':hover')) {
                            tooltip.style.display = 'none';
                        }
                    }, 100);
                }
            });

            tooltip.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    tooltip.style.display = 'none';
                }
            });

            // Mobile: Show on tap, hide on outside click
            infoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                updateUpchargeTooltipContent();
                tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
            });

            // Close tooltip when clicking outside
            document.addEventListener('click', (e) => {
                if (!tooltip.contains(e.target) && e.target !== infoIcon) {
                    tooltip.style.display = 'none';
                }
            });

            // Setup Fee Tooltip - Similar interaction pattern
            const setupFeeBadge = document.getElementById('setup-fee-badge');
            const setupFeeTooltip = document.getElementById('setup-fee-tooltip');

            if (setupFeeBadge && setupFeeTooltip) {
                dtgLog('✅ Initializing setup fee tooltip');

                // Desktop: Show on hover
                setupFeeBadge.addEventListener('mouseenter', () => {
                    if (window.innerWidth > 768) {
                        setupFeeTooltip.style.display = 'block';
                    }
                });

                setupFeeBadge.addEventListener('mouseleave', () => {
                    if (window.innerWidth > 768) {
                        setTimeout(() => {
                            if (!setupFeeTooltip.matches(':hover')) {
                                setupFeeTooltip.style.display = 'none';
                            }
                        }, 100);
                    }
                });

                setupFeeTooltip.addEventListener('mouseleave', () => {
                    if (window.innerWidth > 768) {
                        setupFeeTooltip.style.display = 'none';
                    }
                });

                // Mobile: Show on tap
                setupFeeBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setupFeeTooltip.style.display = setupFeeTooltip.style.display === 'block' ? 'none' : 'block';
                });

                // Close when clicking outside
                document.addEventListener('click', (e) => {
                    if (!setupFeeTooltip.contains(e.target) && e.target !== setupFeeBadge) {
                        setupFeeTooltip.style.display = 'none';
                    }
                });
            }
        }

        // Update upcharge tooltip content from API data
        function updateUpchargeTooltipContent() {
            const tooltipBody = document.getElementById('upcharge-tooltip-body');
            if (!tooltipBody) return;

            // Get available sizes for this product
            const availableSizes = pricingData?.pricing?.sizes?.map(s => s.size) || [];

            // Get all upcharges from API
            const allUpcharges = pricingData?.pricing?.upcharges || {};

            // Filter to only show upcharges for sizes that exist for this product
            const upcharges = {};
            Object.entries(allUpcharges).forEach(([size, amount]) => {
                if (availableSizes.includes(size) && amount > 0) {
                    upcharges[size] = amount;
                }
            });

            dtgLog('🎯 Tooltip updating with data:', {
                availableSizes,
                allUpcharges,
                filteredUpcharges: upcharges
            });

            // Build tooltip content
            let html = '';

            // Base price info - show only sizes without upcharges
            const baseSizes = availableSizes.filter(size => !upcharges[size]);
            if (baseSizes.length > 0) {
                html += '<div class="upcharge-base">';
                html += '<div class="upcharge-item">';
                html += `<span class="upcharge-item-size">${baseSizes.join(', ')}</span>`;
                html += '<span class="upcharge-item-price">Base Price</span>';
                html += '</div>';
                html += '</div>';
            }

            // Sort upcharge sizes for display
            const upchargeSizes = Object.keys(upcharges).sort((a, b) => {
                // Custom sort: 2XL, 3XL, 4XL, 5XL, 6XL, then others
                const sizeOrder = ['2XL', '3XL', '4XL', '5XL', '6XL'];
                const aIndex = sizeOrder.indexOf(a);
                const bIndex = sizeOrder.indexOf(b);

                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
            });

            // Add upcharge items
            upchargeSizes.forEach(size => {
                const upcharge = upcharges[size];
                if (upcharge > 0) {
                    html += '<div class="upcharge-item">';
                    html += `<span class="upcharge-item-size">${size}</span>`;
                    html += `<span class="upcharge-item-price">+$${upcharge.toFixed(2)}</span>`;
                    html += '</div>';
                }
            });

            // If no upcharges found
            if (upchargeSizes.length === 0) {
                html += '<div style="text-align: center; color: #6b7280; padding: 10px;">';
                html += 'No size upcharges for this style';
                html += '</div>';
            }

            tooltipBody.innerHTML = html;
        }

        // Toggle a location on/off with validation
        function toggleLocation(locationCode) {
            // Map BON to LC for pricing calculations
            const pricingLocationCode = locationCode === 'BON' ? 'LC' : locationCode;

            const index = toggleState.selectedLocations.indexOf(locationCode);
            const isCurrentlyOn = index !== -1;

            // Define front and back locations (BON is a front location)
            const frontLocations = ['LC', 'BON', 'FF', 'JF'];
            const backLocations = ['FB', 'JB'];
            const isFront = frontLocations.includes(locationCode);
            const isBack = backLocations.includes(locationCode);

            if (isCurrentlyOn) {
                // Turn OFF: Remove from selected locations
                toggleState.selectedLocations.splice(index, 1);
                updateToggleUI(locationCode, false);
                dtgLog(`🔴 Toggled OFF: ${locationCode}`);
            } else {
                // Turn ON: Check constraints
                const currentFrontCount = toggleState.selectedLocations.filter(loc => frontLocations.includes(loc)).length;
                const currentBackCount = toggleState.selectedLocations.filter(loc => backLocations.includes(loc)).length;

                // Validation: Max 1 front + Max 1 back = Max 2 total
                if (isFront && currentFrontCount >= 1) {
                    // Already have a front location - turn off the old one first
                    const oldFrontLocation = toggleState.selectedLocations.find(loc => frontLocations.includes(loc));
                    toggleState.selectedLocations = toggleState.selectedLocations.filter(loc => loc !== oldFrontLocation);
                    updateToggleUI(oldFrontLocation, false);
                    dtgLog(`🔄 Replacing front location ${oldFrontLocation} with ${locationCode}`);
                }

                if (isBack && currentBackCount >= 1) {
                    // Already have a back location - turn off the old one first
                    const oldBackLocation = toggleState.selectedLocations.find(loc => backLocations.includes(loc));
                    toggleState.selectedLocations = toggleState.selectedLocations.filter(loc => loc !== oldBackLocation);
                    updateToggleUI(oldBackLocation, false);
                    dtgLog(`🔄 Replacing back location ${oldBackLocation} with ${locationCode}`);
                }

                // Add the new location
                toggleState.selectedLocations.push(locationCode);
                updateToggleUI(locationCode, true);
                dtgLog(`🟢 Toggled ON: ${locationCode}`);
            }

            // Update live price display
            updateLivePriceDisplay();
        }

        // Update toggle UI visual state
        function updateToggleUI(locationCode, isOn) {
            const toggleElement = document.getElementById(`toggle-${locationCode}`);
            if (!toggleElement) return;

            const toggleSwitch = toggleElement.querySelector('.toggle-switch');
            if (isOn) {
                toggleElement.classList.add('active');  // Add to card
                toggleSwitch.classList.add('on');
            } else {
                toggleElement.classList.remove('active');  // Remove from card
                toggleSwitch.classList.remove('on');
            }
        }

        // Select a tier
        function selectTier(tierLabel) {
            dtgLog(`📊 Selected tier: ${tierLabel}`);

            // Update state
            toggleState.selectedTier = tierLabel;

            // Update button UI
            document.querySelectorAll('.tier-button').forEach(button => {
                if (button.dataset.tier === tierLabel) {
                    button.classList.add('selected');
                } else {
                    button.classList.remove('selected');
                }
            });

            // Show/hide LTM quantity input container
            updateLTMQuantityInput(tierLabel);

            // Update live price display
            updateLivePriceDisplay();
        }

        // ==================== LTM QUANTITY INPUT FUNCTIONS ====================

        // Show/hide LTM quantity input container based on selected tier
        function updateLTMQuantityInput(tierLabel) {
            const container = document.getElementById('dtg-ltm-quantity-container');
            if (!container) return;

            if (tierLabel === '1-23') {
                // Show the input container
                container.style.display = 'flex';
                container.classList.add('show');

                // Update the fee calculation display
                const input = document.getElementById('dtg-ltm-quantity-input');
                if (input) {
                    updateLTMFeeDisplay(parseInt(input.value) || 12);
                }

                dtgLog('✅ LTM quantity input shown');
            } else {
                // Hide the input container
                container.style.display = 'none';
                container.classList.remove('show');

                dtgLog('❌ LTM quantity input hidden');
            }
        }

        // Read the LTM fee from the Caspio Pricing_Tiers row for the LTM tier.
        // Falls back to 50 only if the bundle didn't load yet (defensive).
        function getLTMFeeFromBundle() {
            const tiers = (pricingData && pricingData.pricing && pricingData.pricing.tiers) || [];
            const ltmTier = tiers.find(t => Number(t.LTM_Fee || 0) > 0);
            return ltmTier ? Number(ltmTier.LTM_Fee) : 50.00;
        }

        // Update the LTM fee calculation display
        function updateLTMFeeDisplay(quantity) {
            const feeCalc = document.getElementById('dtg-ltm-fee-calc');
            if (!feeCalc) return;

            const ltmFee = getLTMFeeFromBundle();
            const feePerShirt = Math.floor((ltmFee / quantity) * 100) / 100;

            feeCalc.innerHTML = `$${ltmFee.toFixed(2)} ÷ ${quantity} = <span style="color: #4cb354;">$${feePerShirt.toFixed(2)}/shirt</span>`;

            dtgLog(`💰 LTM fee updated: $${feePerShirt.toFixed(2)}/shirt for ${quantity} pieces (Caspio LTM_Fee = $${ltmFee})`);
        }

        // Handle LTM quantity input changes (real-time)
        function handleLTMQuantityInput(e) {
            const value = parseInt(e.target.value);

            if (!isNaN(value) && value >= 1 && value <= 23) {
                updateLTMFeeDisplay(value);
                // Update the live price display to include LTM fee
                updateLivePriceDisplay();
            }
        }

        // Validate LTM quantity input on blur
        function validateLTMQuantityInput(e) {
            let value = parseInt(e.target.value);

            // Enforce min/max bounds
            if (isNaN(value) || value < 1) {
                value = 1;
            } else if (value > 23) {
                value = 23;
            }

            e.target.value = value;
            updateLTMFeeDisplay(value);
            // Update the live price display to include LTM fee
            updateLivePriceDisplay();

            dtgLog(`✓ LTM quantity validated: ${value}`);
        }

        // Calculate and update live price display
        function updateLivePriceDisplay() {
            const priceAmountElement = document.getElementById('live-price-amount');
            const priceDetailElement = document.getElementById('live-price-detail');
            const priceFeeElement = document.getElementById('live-price-fee');

            if (!priceAmountElement || !priceDetailElement) {
                console.error('❌ Live price display elements not found');
                return;
            }

            // Check if any locations are selected
            if (toggleState.selectedLocations.length === 0) {
                priceAmountElement.textContent = '$0.00';
                priceDetailElement.textContent = 'Select a location to see pricing';
                if (priceFeeElement) priceFeeElement.textContent = '';
                return;
            }

            try {
                // Calculate price based on selected locations
                let finalPrice = 0;

                // Map BON locations to LC for pricing
                const pricingLocations = toggleState.selectedLocations.map(loc => loc === 'BON' ? 'LC' : loc);

                // Format tier display text
                const displayTier = toggleState.selectedTier === '1-23' ? 'Less than 24' : toggleState.selectedTier;

                if (toggleState.selectedLocations.length === 1) {
                    // Single location: Use standard pricing
                    const locationCode = pricingLocations[0];
                    dtgLog(`🔍 DEBUG: Calling getDTGPrice('${locationCode}', '${toggleState.selectedTier}')`);
                    finalPrice = getDTGPrice(locationCode, toggleState.selectedTier);
                    const locationName = getLocationName(toggleState.selectedLocations[0]);
                    priceDetailElement.textContent = `${locationName} • ${displayTier} pieces`;

                } else if (toggleState.selectedLocations.length === 2) {
                    // Combo location: Build combo code and get price
                    const [loc1, loc2] = pricingLocations.sort(); // Sort for consistent combo code
                    const comboCode = `${loc1}_${loc2}`;
                    finalPrice = getDTGPrice(comboCode, toggleState.selectedTier);
                    const loc1Name = getLocationName(toggleState.selectedLocations[0]);
                    const loc2Name = getLocationName(toggleState.selectedLocations[1]);
                    priceDetailElement.textContent = `${loc1Name} + ${loc2Name} • ${displayTier} pieces`;
                }

                // Add LTM fee to price if tier is under 24 pieces.
                // LTM fee value comes from Caspio's Pricing_Tiers row for
                // the LTM tier (today: 1-23 row, LTM_Fee = 50). No hardcoding.
                if (toggleState.selectedTier === '1-23') {
                    const ltmQuantityInput = document.getElementById('dtg-ltm-quantity-input');
                    const quantity = ltmQuantityInput ? parseInt(ltmQuantityInput.value) || 12 : 12;

                    const ltmFee = getLTMFeeFromBundle();
                    // Math.floor((fee/qty)*100)/100 — DTG LTM convention,
                    // floor (not round) to prevent overcharge per MEMORY.md.
                    const ltmFeePerShirt = Math.floor((ltmFee / quantity) * 100) / 100;

                    finalPrice += ltmFeePerShirt;

                    dtgLog(`💰 LTM fee per shirt: $${ltmFeePerShirt.toFixed(2)} (${quantity} pieces, Caspio LTM_Fee = $${ltmFee})`);
                }

                // Update price display
                priceAmountElement.textContent = `$${finalPrice.toFixed(2)}`;

                // Hide the yellow LTM fee box since fee is now included in the price
                if (priceFeeElement) {
                    priceFeeElement.textContent = '';
                    priceFeeElement.style.display = 'none';
                }

                dtgLog(`💰 Live price updated: $${finalPrice.toFixed(2)}`);

            } catch (error) {
                console.error('❌ Error calculating live price:', error);
                priceAmountElement.textContent = 'Error';
                priceDetailElement.textContent = error.message || 'Unable to calculate price';
                if (priceFeeElement) priceFeeElement.textContent = '';
            }
        }

        // Helper: Get location display name
        function getLocationName(locationCode) {
            const locationNames = {
                'LC': 'Left Chest',
                'BON': 'Back of Neck',
                'FF': 'Full Front',
                'JF': 'Jumbo Front',
                'FB': 'Full Back',
                'JB': 'Jumbo Back'
            };
            return locationNames[locationCode] || locationCode;
        }

        // ========================================
        // END TOGGLE SWITCH PRICING INTERFACE
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

        // Update product information with images and colors
        function updateProductInfo(product, styleNumber) {
            dtgLog('📝 Updating product info with:', product);

            // Update breadcrumb Products link to include style parameter
            const productsBreadcrumb = document.getElementById('products-breadcrumb');
            if (productsBreadcrumb && styleNumber) {
                productsBreadcrumb.href = `/product.html?style=${styleNumber}`;
                dtgLog('✅ Updated products breadcrumb with style:', styleNumber);
            }

            // Use PRODUCT_TITLE from API or fallback
            const title = product.PRODUCT_TITLE || product.title || `${styleNumber} - DTG Pricing`;

            // Use PRODUCT_DESCRIPTION from API or fallback
            const description = product.PRODUCT_DESCRIPTION || product.description || 'Direct-to-Garment printing pricing';

            // Use BRAND_NAME from API, with intelligent fallback
            const brand = product.BRAND_NAME || product.brand || getBrandFromStyle(styleNumber);

            document.getElementById('productTitle').textContent = title;
            document.getElementById('productDescription').textContent = description;
            document.getElementById('currentStyle').textContent = `#${styleNumber.toUpperCase()}`;
            document.getElementById('currentBrand').textContent = brand;

            // Update product image
            updateProductImage(product);

            // Update color swatches
            updateColorSwatches(product);

            dtgLog('✅ Product info updated:', { title, description, brand });
        }

        // Update product image
        function updateProductImage(product) {
            const imageEl = document.getElementById('productImage');
            const placeholderEl = document.getElementById('imagePlaceholder');

            // Check for API product image fields first
            let imageUrl = product.FRONT_MODEL || product.FRONT_FLAT || product.PRODUCT_IMAGE;

            if (imageUrl) {
                // Use image from product details API
                imageEl.src = imageUrl;
                imageEl.style.display = 'block';
                placeholderEl.style.display = 'none';
                dtgLog('✅ Product image updated from API:', imageUrl);

                // Update color if available from API
                if (product.COLOR_NAME) {
                    document.getElementById('currentColor').textContent = product.COLOR_NAME;
                }
            } else if (product.colors && product.colors.length > 0) {
                // Fallback to color images
                const firstColorWithImage = product.colors.find(c => c.MAIN_IMAGE_URL) || product.colors[0];

                if (firstColorWithImage && firstColorWithImage.MAIN_IMAGE_URL) {
                    imageEl.src = firstColorWithImage.MAIN_IMAGE_URL;
                    imageEl.style.display = 'block';
                    placeholderEl.style.display = 'none';

                    // Update current color display
                    if (firstColorWithImage.COLOR_NAME) {
                        document.getElementById('currentColor').textContent = firstColorWithImage.COLOR_NAME;
                    }
                } else {
                    imageEl.style.display = 'none';
                    placeholderEl.style.display = 'flex';
                }
            } else {
                imageEl.style.display = 'none';
                placeholderEl.style.display = 'flex';
            }
        }

        // Update color swatches
        function updateColorSwatches(product) {
            const swatchesSection = document.getElementById('colorSwatchesSection');
            const swatchesContainer = document.getElementById('colorSwatches');

            if (product.colors && product.colors.length > 0) {
                swatchesContainer.innerHTML = '';

                product.colors.forEach(color => {
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
                    `;

                    if (color.HEX_CODE) {
                        swatch.style.backgroundColor = color.HEX_CODE;
                    } else if (color.COLOR_SQUARE_IMAGE) {
                        swatch.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
                        swatch.style.backgroundSize = 'cover';
                    } else {
                        // Default pattern for missing color
                        swatch.style.background = 'linear-gradient(135deg, #f0f0f0 25%, #e0e0e0 25%, #e0e0e0 50%, #f0f0f0 50%, #f0f0f0 75%, #e0e0e0 75%)';
                        swatch.style.backgroundSize = '20px 20px';
                    }

                    swatch.title = color.COLOR_NAME || 'Color';

                    // Add click handler to change product image
                    swatch.addEventListener('click', () => {
                        if (color.MAIN_IMAGE_URL) {
                            document.getElementById('productImage').src = color.MAIN_IMAGE_URL;
                            document.getElementById('currentColor').textContent = color.COLOR_NAME || 'Selected';
                            // Highlight selected swatch
                            document.querySelectorAll('.color-swatch').forEach(s => s.style.border = '2px solid #e5e7eb');
                            swatch.style.border = '2px solid #4cb354';
                        }
                        // Load warehouse inventory
                        if (typeof loadCalculatorInventory === 'function') {
                            loadCalculatorInventory(currentStyleNumber || window.currentStyleNumber, color.CATALOG_COLOR || color.COLOR_NAME, color.COLOR_NAME, color.COLOR_SQUARE_IMAGE);
                        }
                    });

                    swatchesContainer.appendChild(swatch);
                });

                swatchesSection.style.display = 'block';
            } else {
                swatchesSection.style.display = 'none';
            }
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
                resultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
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

        // Show/hide functions
        function showLoading() {
            loadingState.style.display = 'flex';
            productHero.style.display = 'none';
            pricingSection.style.display = 'none';
        }

        function showProduct() {
            loadingState.style.display = 'none';
            productHero.style.display = 'block';
            pricingSection.style.display = 'block';
        }

        function showNoProduct() {
            loadingState.innerHTML = `
                <i class="fas fa-search"></i>
                <p>Search for a style to view DTG pricing</p>
            `;
        }

        function showApiError(message) {
            console.error('🚨 DTG API Error:', message);
            // Show error in console for now - could add error banner like cap embroidery
            dtgInlineAlert('DTG Pricing Error: ' + message);
        }

        // 🧪 Testing utilities
        window.DTG_DEBUG = {
            // Test API directly
            testAPI: async function(styleNumber = 'PC61') {
                dtgLog('🧪 Testing DTG API for:', styleNumber);
                const response = await fetch(`${DTG_API_BASE}/api/dtg/product-bundle?styleNumber=${styleNumber}`);
                const data = await response.json();
                dtgLog('✅ API Response:', data);
                return data;
            },

            // Get current state
            getState: function() {
                return {
                    pricingData: pricingData,
                    currentProduct: currentProduct,
                    tableExists: !!document.getElementById('dtg-pricing-tbody')
                };
            },

            // Force table update
            updateTable: function() {
                updateDTGPricing();
            }
        };

        dtgLog('🎯 DTG Nuclear Solution Loaded - Simple & Clean!');
