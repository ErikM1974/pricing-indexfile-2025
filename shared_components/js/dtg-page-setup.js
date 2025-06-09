/**
 * DTG Page Setup - Minimal navigation and swatch handling for DTG pricing page
 * Provides only the essential functions needed for DTG without legacy cart conflicts
 */

(function() {
    "use strict";

    console.log("DTG-PAGE-SETUP: Initializing DTG page setup...");

    // Configuration
    const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    
    // Global state
    window.selectedStyleNumber = null;
    window.selectedColorName = null;
    window.selectedCatalogColor = null;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDTGPage);
    } else {
        initializeDTGPage();
    }

    function initializeDTGPage() {
        console.log("DTG-PAGE-SETUP: DOM ready, initializing...");
        updateProductContext();
        setupBackButton();
        setupImageZoom();
    }

    function updateProductContext() {
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        const colorFromUrl = urlParams.get('COLOR');

        // Check for placeholder values
        if (styleNumber === '{styleNumber}' || colorFromUrl === '{colorCode}' || !styleNumber) {
            console.error("DTG-PAGE-SETUP: Invalid URL parameters", { styleNumber, colorFromUrl });
            return;
        }

        console.log(`DTG-PAGE-SETUP: Product Context: StyleNumber=${styleNumber}, COLOR=${colorFromUrl}`);

        // Update global state
        window.selectedStyleNumber = styleNumber;
        window.selectedColorName = colorFromUrl ? decodeURIComponent(colorFromUrl.replace(/\+/g, ' ')) : null;
        window.selectedCatalogColor = window.selectedColorName;

        // Update UI elements
        const styleElContext = document.getElementById('product-style-context');
        const titleElContext = document.getElementById('product-title-context');
        
        if (styleElContext) styleElContext.textContent = styleNumber || 'N/A';
        if (titleElContext) titleElContext.textContent = `DTG Pricing - ${styleNumber}`;

        // Load product details and swatches
        if (styleNumber) {
            fetchProductDetails(styleNumber);
        }
    }

    function setupBackButton() {
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        const colorFromUrl = urlParams.get('COLOR');
        
        const backLink = document.getElementById('back-to-product');
        if (backLink && styleNumber) {
            // Set the back button to return to product page with current parameters
            backLink.href = `/product.html?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorFromUrl || '')}`;
            console.log("DTG-PAGE-SETUP: Back button configured:", backLink.href);
        } else if (backLink) {
            backLink.href = '/product.html';
        }
    }

    async function fetchProductDetails(styleNumber) {
        console.log(`DTG-PAGE-SETUP: Fetching product details for ${styleNumber}`);
        
        try {
            const apiUrl = `${API_PROXY_BASE_URL}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const productData = await response.json();
            console.log("DTG-PAGE-SETUP: Product data received:", productData);
            
            if (!productData || !productData.colors || productData.colors.length === 0) {
                throw new Error('No product data or colors available');
            }

            // Update product title
            const titleElContext = document.getElementById('product-title-context');
            if (titleElContext && productData.productTitle) {
                titleElContext.textContent = productData.productTitle;
            }

            // Find the selected color or use first color
            const urlParams = new URLSearchParams(window.location.search);
            const colorParam = urlParams.get('COLOR');
            
            let selectedColorObject = null;
            if (colorParam) {
                selectedColorObject = productData.colors.find(c => 
                    c.CATALOG_COLOR === colorParam || c.COLOR_NAME === colorParam
                );
            }
            
            if (!selectedColorObject && productData.colors.length > 0) {
                selectedColorObject = productData.colors[0];
            }

            // Store product data globally for Universal Product Display
            window.productColors = productData.colors;
            window.selectedColorData = selectedColorObject;

            // Dispatch productColorsReady event for Universal Product Display
            console.log("DTG-PAGE-SETUP: Dispatching productColorsReady event");
            window.dispatchEvent(new CustomEvent('productColorsReady', {
                detail: {
                    colors: productData.colors,
                    selectedColor: selectedColorObject,
                    productTitle: productData.productTitle
                }
            }));

            // Wait for Universal Product Display to be ready
            waitForUniversalProductDisplay(() => {
                // Update product image with selected color
                if (selectedColorObject) {
                    updateProductImage(selectedColorObject);
                }

                // Populate color swatches
                populateColorSwatches(productData.colors);

                // Update display for selected color
                if (selectedColorObject) {
                    updateSelectedColorDisplay(selectedColorObject);
                    
                    // Mark the active swatch
                    const swatches = document.querySelectorAll('#color-swatches .color-swatch');
                    swatches.forEach(swatch => {
                        if (swatch.dataset.catalogColor === selectedColorObject.CATALOG_COLOR) {
                            swatch.classList.add('active');
                        }
                    });
                }
            });

        } catch (error) {
            console.error('DTG-PAGE-SETUP: Error fetching product details:', error);
            const titleElContext = document.getElementById('product-title-context');
            if (titleElContext) titleElContext.textContent = 'Error Loading Product';
        }
    }

    // Helper function to wait for Universal Product Display elements
    function waitForUniversalProductDisplay(callback) {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        const checkElements = setInterval(() => {
            attempts++;
            
            // Check if the required elements exist
            const mainImage = document.getElementById('product-image-main');
            const colorSwatches = document.getElementById('color-swatches');
            
            if ((mainImage || colorSwatches) || attempts >= maxAttempts) {
                clearInterval(checkElements);
                if (attempts >= maxAttempts) {
                    console.warn('DTG-PAGE-SETUP: Timeout waiting for Universal Product Display elements');
                } else {
                    console.log('DTG-PAGE-SETUP: Universal Product Display elements found, proceeding');
                }
                callback();
            }
        }, 100);
    }

    function populateColorSwatches(colors) {
        const swatchesContainer = document.getElementById('color-swatches');
        const inlineSwatchArea = document.getElementById('inline-swatch-area');
        
        if (!swatchesContainer && !inlineSwatchArea) {
            console.warn("DTG-PAGE-SETUP: No color swatch containers found");
            return;
        }

        console.log(`DTG-PAGE-SETUP: Populating ${colors.length} color swatches`);

        // Populate main swatches container (visible in left column)
        if (swatchesContainer) {
            swatchesContainer.innerHTML = '';
            
            colors.forEach(color => {
                const swatchWrapper = document.createElement('div');
                swatchWrapper.className = 'swatch-wrapper';
                
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.dataset.colorName = color.COLOR_NAME;
                swatch.dataset.catalogColor = color.CATALOG_COLOR;
                swatch.title = color.COLOR_NAME;
                
                // Set background image or color
                if (color.COLOR_SQUARE_IMAGE) {
                    swatch.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
                } else if (color.COLOR_SWATCH_IMAGE_URL) {
                    swatch.style.backgroundImage = `url('${color.COLOR_SWATCH_IMAGE_URL}')`;
                } else {
                    swatch.style.backgroundColor = normalizeColorName(color.COLOR_NAME);
                }

                swatch.addEventListener('click', () => handleColorSwatchClick(color));
                
                const name = document.createElement('span');
                name.className = 'color-name';
                name.textContent = color.COLOR_NAME;
                
                swatchWrapper.appendChild(swatch);
                swatchWrapper.appendChild(name);
                swatchesContainer.appendChild(swatchWrapper);
            });
        }

        // Also populate inline swatch area for compatibility
        if (inlineSwatchArea) {
            inlineSwatchArea.innerHTML = '<p>Available Colors:</p>';
            
            const inlineContainer = document.createElement('div');
            inlineContainer.className = 'swatch-container';
            
            colors.forEach(color => {
                const swatchWrapper = document.createElement('div');
                swatchWrapper.className = 'swatch-wrapper';
                
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch-item';
                swatch.dataset.colorName = color.COLOR_NAME;
                swatch.dataset.catalogColor = color.CATALOG_COLOR;
                swatch.title = color.COLOR_NAME;
                
                if (color.COLOR_SQUARE_IMAGE) {
                    swatch.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
                } else if (color.COLOR_SWATCH_IMAGE_URL) {
                    swatch.style.backgroundImage = `url('${color.COLOR_SWATCH_IMAGE_URL}')`;
                } else {
                    swatch.style.backgroundColor = normalizeColorName(color.COLOR_NAME);
                }

                swatch.addEventListener('click', () => handleColorSwatchClick(color));
                
                const name = document.createElement('div');
                name.className = 'color-name';
                name.textContent = color.COLOR_NAME;
                
                swatchWrapper.appendChild(swatch);
                swatchWrapper.appendChild(name);
                inlineContainer.appendChild(swatchWrapper);
            });
            
            inlineSwatchArea.appendChild(inlineContainer);
        }
    }

    function handleColorSwatchClick(colorData) {
        console.log("DTG-PAGE-SETUP: Color swatch clicked:", colorData.COLOR_NAME);
        
        if (!colorData || !colorData.COLOR_NAME) {
            console.error("DTG-PAGE-SETUP: Invalid color data");
            return;
        }

        // Update global state
        window.selectedColorName = colorData.COLOR_NAME;
        window.selectedCatalogColor = colorData.CATALOG_COLOR || colorData.COLOR_NAME;
        window.selectedColorData = colorData;

        // Update active swatch styling in both containers
        const allSwatches = document.querySelectorAll('#color-swatches .color-swatch, #inline-swatch-area .color-swatch-item');
        allSwatches.forEach(swatch => swatch.classList.remove('active', 'active-swatch'));
        
        const clickedSwatches = document.querySelectorAll(`[data-catalog-color="${colorData.CATALOG_COLOR}"]`);
        clickedSwatches.forEach(swatch => {
            swatch.classList.add('active', 'active-swatch');
        });

        // Update selected color display
        updateSelectedColorDisplay(colorData);
        
        // Update product image with selected color
        updateProductImage(colorData);

        // Update URL parameters
        const url = new URL(window.location);
        url.searchParams.set('COLOR', colorData.CATALOG_COLOR);
        window.history.replaceState({}, '', url);

        // Dispatch colorChanged event for Universal Product Display
        window.dispatchEvent(new CustomEvent('colorChanged', {
            detail: colorData
        }));

        // Trigger pricing updates if DTG adapter is loaded
        if (window.nwcaPricingData && typeof window.updateCustomPricingGrid === 'function') {
            console.log("DTG-PAGE-SETUP: Triggering pricing update for new color");
            // Update pricing data with new color
            window.nwcaPricingData.color = colorData.CATALOG_COLOR;
            window.updateCustomPricingGrid(window.nwcaPricingData);
        }
    }

    function updateSelectedColorDisplay(colorData) {
        // Update pricing header color display
        const pricingColorName = document.getElementById('pricing-color-name');
        const pricingColorSwatch = document.getElementById('pricing-color-swatch');
        
        if (pricingColorName) {
            pricingColorName.textContent = colorData.COLOR_NAME;
        }
        
        if (pricingColorSwatch) {
            if (colorData.COLOR_SQUARE_IMAGE) {
                pricingColorSwatch.style.backgroundImage = `url('${colorData.COLOR_SQUARE_IMAGE}')`;
                pricingColorSwatch.style.backgroundColor = '';
            } else {
                pricingColorSwatch.style.backgroundImage = '';
                pricingColorSwatch.style.backgroundColor = normalizeColorName(colorData.COLOR_NAME);
            }
        }
    }

    function updateProductImage(colorData) {
        console.log("DTG-PAGE-SETUP: Updating product image with color data:", colorData);
        
        // Get the main product image elements (try both IDs for compatibility)
        const mainImage = document.getElementById('product-image-main') || document.getElementById('main-product-image-dp2');
        const mainImageContainer = document.getElementById('main-image-container');
        
        if (mainImage && colorData) {
            // Determine the best image URL to use
            const imageUrl = colorData.MAIN_IMAGE_URL ||
                           colorData.FRONT_MODEL ||
                           colorData.FRONT_MODEL_IMAGE_URL ||
                           colorData.FRONT_FLAT || '';
            
            if (imageUrl) {
                console.log("DTG-PAGE-SETUP: Setting image URL:", imageUrl);
                
                // Add loading state
                if (mainImageContainer) {
                    mainImageContainer.classList.add('loading');
                }
                
                mainImage.onload = function() {
                    console.log("DTG-PAGE-SETUP: Image loaded successfully");
                    if (mainImageContainer) {
                        mainImageContainer.classList.remove('loading');
                    }
                };
                
                mainImage.onerror = function() {
                    console.error("DTG-PAGE-SETUP: Failed to load image:", imageUrl);
                    if (mainImageContainer) {
                        mainImageContainer.classList.remove('loading');
                    }
                };
                
                mainImage.src = imageUrl;
                mainImage.alt = `${window.selectedStyleNumber || 'Product'} - ${colorData.COLOR_NAME}`;
                mainImage.style.display = 'block';
            } else {
                console.warn("DTG-PAGE-SETUP: No image URL found for color:", colorData.COLOR_NAME);
            }
            
            // Populate thumbnails
            populateThumbnails(colorData);
        } else {
            console.warn("DTG-PAGE-SETUP: Main image element not found or no color data provided");
        }
    }

    function populateThumbnails(colorData) {
        const thumbnailsContainer = document.getElementById('image-thumbnails');
        if (!thumbnailsContainer) {
            console.warn("DTG-PAGE-SETUP: Thumbnails container not found");
            return;
        }

        // Clear existing thumbnails
        thumbnailsContainer.innerHTML = '';

        // Define thumbnail views with their labels
        const views = [
            {
                url: colorData.FRONT_MODEL || colorData.FRONT_MODEL_IMAGE_URL || colorData.MAIN_IMAGE_URL,
                label: 'Main',
                active: true
            },
            {
                url: colorData.BACK_MODEL || colorData.BACK_MODEL_IMAGE_URL,
                label: 'Back'
            },
            {
                url: colorData.SIDE_MODEL || colorData.SIDE_MODEL_IMAGE_URL,
                label: 'Side'
            },
            {
                url: colorData.THREE_QUARTER_MODEL || colorData.THREE_QUARTER_IMAGE_URL,
                label: '3/4 View'
            },
            {
                url: colorData.FRONT_FLAT || colorData.FRONT_FLAT_IMAGE_URL,
                label: 'Front Flat'
            },
            {
                url: colorData.BACK_FLAT || colorData.BACK_FLAT_IMAGE_URL,
                label: 'Back Flat'
            }
        ];

        // Create thumbnails for available views
        views.forEach((view, index) => {
            if (view.url) {
                const thumbnailItem = document.createElement('div');
                thumbnailItem.className = 'thumbnail-item' + (view.active ? ' active' : '');
                
                const thumbnailImg = document.createElement('img');
                thumbnailImg.src = view.url;
                thumbnailImg.alt = `${view.label} view`;
                
                const thumbnailLabel = document.createElement('div');
                thumbnailLabel.className = 'thumbnail-label';
                thumbnailLabel.textContent = view.label;
                
                thumbnailItem.appendChild(thumbnailImg);
                thumbnailItem.appendChild(thumbnailLabel);
                
                // Add click handler
                thumbnailItem.addEventListener('click', function() {
                    // Update main image
                    const mainImage = document.getElementById('product-image-main');
                    if (mainImage) {
                        mainImage.src = view.url;
                        mainImage.alt = `${window.selectedStyleNumber || 'Product'} - ${colorData.COLOR_NAME} - ${view.label}`;
                    }
                    
                    // Update active state
                    document.querySelectorAll('.thumbnail-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    thumbnailItem.classList.add('active');
                });
                
                thumbnailsContainer.appendChild(thumbnailItem);
            }
        });

        // If no thumbnails were added, hide the container
        if (thumbnailsContainer.children.length === 0) {
            thumbnailsContainer.style.display = 'none';
        } else {
            thumbnailsContainer.style.display = 'flex';
        }
    }

    function normalizeColorName(colorName) {
        if (!colorName) return '#cccccc';
        
        const colorMap = {
            'black': '#000000',
            'white': '#ffffff',
            'red': '#ff0000',
            'blue': '#0000ff',
            'green': '#008000',
            'yellow': '#ffff00',
            'orange': '#ffa500',
            'purple': '#800080',
            'pink': '#ffc0cb',
            'brown': '#a52a2a',
            'gray': '#808080',
            'grey': '#808080',
            'navy': '#000080',
            'maroon': '#800000',
            'lime': '#00ff00',
            'aqua': '#00ffff',
            'silver': '#c0c0c0'
        };
        
        const normalized = colorName.toLowerCase().replace(/\s+/g, '');
        return colorMap[normalized] || '#cccccc';
    }

    function setupImageZoom() {
        // Setup zoom functionality for main image
        const zoomOverlay = document.querySelector('.image-zoom-overlay');
        const mainImage = document.getElementById('product-image-main');
        const modal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');
        const modalCaption = document.getElementById('modal-caption');
        const closeModal = document.querySelector('.close-modal');
        
        if (zoomOverlay && mainImage && modal) {
            // Click on zoom icon
            zoomOverlay.addEventListener('click', function() {
                modal.style.display = 'block';
                modalImage.src = mainImage.src;
                modalCaption.textContent = mainImage.alt;
            });
            
            // Also allow clicking on the main image
            mainImage.style.cursor = 'zoom-in';
            mainImage.addEventListener('click', function() {
                modal.style.display = 'block';
                modalImage.src = mainImage.src;
                modalCaption.textContent = mainImage.alt;
            });
        }
        
        // Close modal functionality
        if (closeModal) {
            closeModal.addEventListener('click', function() {
                modal.style.display = 'none';
            });
        }
        
        if (modal) {
            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        // ESC key to close modal
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && modal && modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    }

    // Export key functions for global access
    window.DTGPageSetup = {
        updateProductContext,
        setupBackButton,
        fetchProductDetails,
        handleColorSwatchClick,
        updateProductImage,
        updateSelectedColorDisplay,
        populateThumbnails,
        setupImageZoom
    };

})();