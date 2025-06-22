/**
 * Universal Product Display Component
 * A modular component for displaying product information, images, and color swatches
 * across all pricing pages (embroidery, cap embroidery, DTG, screen print, DTF)
 */

class UniversalProductDisplay {
    constructor(config = {}) {
        // Set pageType first so it's available for other methods
        const pageType = config.pageType || this.detectPageType();
        
        // Configuration with smart defaults
        this.config = {
            containerId: config.containerId || 'product-display',
            pageType: pageType,
            layout: config.layout || 'column', // 'column' or 'hero'
            sticky: config.sticky || false,
            showBackButton: config.showBackButton !== false,
            showInfoBox: config.showInfoBox !== false,
            enableGallery: config.enableGallery !== false,
            enableSwatches: config.enableSwatches !== false,
            showSelectedColor: config.showSelectedColor !== false,
            mobileColorLimit: config.mobileColorLimit || 6,
            ...config
        };
        
        // Set infoBoxContent after config is initialized
        if (!config.infoBoxContent) {
            this.config.infoBoxContent = this.getDefaultInfoContent();
        }

        // State
        this.state = {
            productTitle: '',
            styleNumber: '',
            selectedColor: '',
            selectedColorData: null,
            images: [],
            isLoading: false
        };

        // Initialize
        this.init();
    }

    init() {
        console.log('[UniversalProductDisplay] Initializing with config:', this.config);
        
        // Get container
        this.container = document.getElementById(this.config.containerId);
        if (!this.container) {
            console.error('[UniversalProductDisplay] Container not found:', this.config.containerId);
            return;
        }

        // Load product data from URL/global state
        this.loadProductData();
        
        // Render the component
        this.render();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize sub-components
        this.initializeSubComponents();
    }

    detectPageType() {
        // Auto-detect page type from URL or page indicators
        const path = window.location.pathname.toLowerCase();
        if (path.includes('cap-embroidery')) return 'cap-embroidery';
        if (path.includes('embroidery')) return 'embroidery';
        if (path.includes('dtg')) return 'dtg';
        if (path.includes('screen-print')) return 'screenprint';
        if (path.includes('dtf')) return 'dtf';
        return 'embroidery'; // default
    }

    getDefaultInfoContent() {
        // Smart defaults based on page type
        const defaults = {
            'embroidery': 'Pricing includes an 8,000 stitch embroidered logo.',
            'cap-embroidery': 'Pricing includes an 8,000 stitch embroidered logo on front.',
            'dtg': 'Pricing includes full-color digital print.',
            'screenprint': 'Pricing based on number of ink colors.',
            'dtf': 'Pricing includes full-color DTF transfer.'
        };
        return defaults[this.config.pageType] || '';
    }

    loadProductData() {
        console.log('[UniversalProductDisplay] Loading product data...');
        
        // Load from URL parameters and global state
        const urlParams = new URLSearchParams(window.location.search);
        
        // Get product info
        this.state.productTitle = window.productTitle || 
                                 document.getElementById('product-title-context')?.textContent || 
                                 'Product Name';
        
        this.state.styleNumber = urlParams.get('StyleNumber') || 
                                window.selectedStyleNumber || 
                                '';
        
        this.state.selectedColor = urlParams.get('COLOR') || 
                                  window.selectedColorName || 
                                  '';
        
        console.log('[UniversalProductDisplay] Initial state:', {
            productTitle: this.state.productTitle,
            styleNumber: this.state.styleNumber,
            selectedColor: this.state.selectedColor
        });
        
        // Get color data if available
        if (window.selectedColorData) {
            this.state.selectedColorData = window.selectedColorData;
            console.log('[UniversalProductDisplay] Found selectedColorData:', window.selectedColorData);
        }
        
        // Also listen for product context updates and product colors ready
        window.addEventListener('productColorsReady', (event) => {
            console.log('[UniversalProductDisplay] Product colors ready event received:', event.detail);
            if (event.detail) {
                // Update product title from the API data
                const titleEl = this.container.querySelector('#product-title-display');
                const titleElContext = document.getElementById('product-title-context');
                if (titleElContext && titleElContext.textContent !== 'Product Title') {
                    this.state.productTitle = titleElContext.textContent;
                    if (titleEl) {
                        titleEl.textContent = this.state.productTitle;
                    }
                }
                
                // Update selected color
                if (event.detail.selectedColor) {
                    this.state.selectedColor = event.detail.selectedColor.COLOR_NAME || this.state.selectedColor;
                    this.state.selectedColorData = event.detail.selectedColor;
                    this.updateSelectedColor(this.state.selectedColorData);
                }
                
                // Re-render gallery if we have new data
                if (this.config.enableGallery) {
                    console.log('[UniversalProductDisplay] Re-initializing gallery with new data');
                    this.initializeSubComponents();
                }
            }
        });
    }

    render() {
        // Build the HTML structure
        this.container.innerHTML = `
            <div class="universal-product-display ${this.config.layout}-layout ${this.config.sticky ? 'sticky-display' : ''}">
                ${this.renderHeader()}
                ${this.renderGallery()}
                ${this.renderInfoBox()}
                ${this.renderColorSwatches()}
            </div>
        `;

        // Add smooth loading transitions
        this.container.classList.add('upd-fade-in');
    }

    renderHeader() {
        const backButton = this.config.showBackButton ? `
            <div class="upd-navigation">
                <a href="${this.getBackUrl()}" class="upd-back-button">
                    <span class="back-icon">←</span> Back to Product
                </a>
            </div>
        ` : '';

        const selectedColorIndicator = this.config.showSelectedColor && this.state.selectedColor ? `
            <div class="upd-selected-color">
                <span class="color-label">Selected:</span>
                <span class="mini-color-swatch" 
                      style="${this.getColorSwatchStyle()}"
                      title="${this.state.selectedColor}"></span>
                <span class="color-name">${this.state.selectedColor}</span>
            </div>
        ` : '';

        return `
            <div class="upd-header">
                ${backButton}
                <div class="upd-product-info">
                    <h2 class="upd-product-title" id="product-title-display">
                        ${this.state.productTitle} ${this.state.styleNumber}
                    </h2>
                    ${selectedColorIndicator}
                    <div class="upd-product-meta">
                        <span class="meta-item">Style: <strong>${this.state.styleNumber}</strong></span>
                    </div>
                </div>
            </div>
        `;
    }

    renderGallery() {
        if (!this.config.enableGallery) return '';
        
        return `
            <div class="upd-gallery-container" id="upd-gallery">
                <!-- Universal Image Gallery will be initialized here -->
                <div class="product-image-gallery" id="product-image-gallery">
                    <div class="main-image-container" id="main-image-container">
                        <img id="product-image-main" 
                             src="${this.getProductImageUrl()}" 
                             alt="${this.state.productTitle}"
                             onerror="this.onerror=null; this.src='${this.getFallbackImage()}';">
                        <div class="image-loading-spinner"></div>
                        <div class="image-zoom-overlay">
                            <span class="zoom-icon">🔍</span>
                        </div>
                    </div>
                    <div class="image-thumbnails" id="image-thumbnails">
                        <!-- Thumbnails will be dynamically added -->
                    </div>
                </div>
            </div>
        `;
    }

    renderInfoBox() {
        if (!this.config.showInfoBox || !this.config.infoBoxContent) return '';
        
        return `
            <div class="upd-info-box">
                <p>${this.config.infoBoxContent}</p>
            </div>
        `;
    }

    renderColorSwatches() {
        if (!this.config.enableSwatches) return '';
        
        return `
            <div class="upd-color-swatches">
                <div class="color-swatches-container compact">
                    <h3 class="section-title">Available Colors</h3>
                    <div class="color-swatches" id="color-swatches">
                        <!-- Color swatches will be populated by dp5-helper -->
                    </div>
                    <button class="show-more-colors" id="show-more-colors" style="display: none;">
                        Show More Colors
                    </button>
                </div>
            </div>
        `;
    }

    getBackUrl() {
        // Smart back URL detection
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        const color = urlParams.get('COLOR');
        
        // Build product page URL with current parameters
        if (styleNumber) {
            let backUrl = `/product.html?StyleNumber=${encodeURIComponent(styleNumber)}`;
            if (color) {
                backUrl += `&COLOR=${encodeURIComponent(color)}`;
            }
            return backUrl;
        }
        
        // If we have a referrer from the same domain, use it
        if (document.referrer && document.referrer.includes(window.location.hostname)) {
            return document.referrer;
        }
        
        // Fallback to products page
        return '/product.html';
    }

    getColorSwatchStyle() {
        if (this.state.selectedColorData) {
            if (this.state.selectedColorData.COLOR_SQUARE_IMAGE) {
                return `background-image: url('${this.state.selectedColorData.COLOR_SQUARE_IMAGE}'); background-size: cover;`;
            }
            if (this.state.selectedColorData.HEX_CODE) {
                return `background-color: ${this.state.selectedColorData.HEX_CODE};`;
            }
        }
        // Fallback color
        return `background-color: ${this.getColorFallback(this.state.selectedColor)};`;
    }

    getColorFallback(colorName) {
        const colorMap = {
            'black': '#000000', 'white': '#FFFFFF', 'navy': '#001F3F', 'royal': '#4169E1',
            'red': '#FF0000', 'forest': '#228B22', 'charcoal': '#36454F', 'grey': '#808080',
            'gray': '#808080', 'ash': '#B2BEB5', 'purple': '#800080', 'maroon': '#800000'
        };
        
        const normalized = colorName.toLowerCase();
        for (const [key, value] of Object.entries(colorMap)) {
            if (normalized.includes(key)) return value;
        }
        return '#CCCCCC';
    }

    getProductImageUrl() {
        // Get product image URL from various sources
        if (this.state.selectedColorData && this.state.selectedColorData.MAIN_IMAGE_URL) {
            return this.state.selectedColorData.MAIN_IMAGE_URL;
        }
        
        if (window.productMainImage) return window.productMainImage;
        
        const existingImage = document.getElementById('product-image-main');
        if (existingImage && existingImage.src && existingImage.src !== window.location.href) {
            return existingImage.src;
        }
        
        return this.getFallbackImage();
    }

    getFallbackImage() {
        // Nice SVG placeholder
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMjAwIiBmaWxsPSIjNmM3NTdkIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiPkltYWdlIE5vdCBBdmFpbGFibGU8L3RleHQ+PC9zdmc+';
    }

    setupEventListeners() {
        // Listen for color changes
        window.addEventListener('colorChanged', (event) => {
            if (event.detail) {
                this.updateSelectedColor(event.detail);
            }
        });

        // Setup mobile color limit
        this.setupMobileColorLimit();
    }

    setupMobileColorLimit() {
        const showMoreBtn = document.getElementById('show-more-colors');
        const colorSwatches = document.getElementById('color-swatches');
        
        if (!showMoreBtn || !colorSwatches) return;

        const checkMobileColors = () => {
            const isMobile = window.innerWidth <= 768;
            const swatches = colorSwatches.querySelectorAll('.swatch-wrapper');
            
            if (isMobile && swatches.length > this.config.mobileColorLimit) {
                // Show limited colors on mobile
                swatches.forEach((swatch, index) => {
                    if (index >= this.config.mobileColorLimit) {
                        swatch.style.display = showMoreBtn.dataset.expanded === 'true' ? 'flex' : 'none';
                    }
                });
                showMoreBtn.style.display = 'block';
            } else {
                // Show all colors on desktop
                swatches.forEach(swatch => swatch.style.display = 'flex');
                showMoreBtn.style.display = 'none';
            }
        };

        // Toggle button functionality
        showMoreBtn.addEventListener('click', () => {
            const isExpanded = showMoreBtn.dataset.expanded === 'true';
            showMoreBtn.dataset.expanded = !isExpanded;
            showMoreBtn.textContent = isExpanded ? 'Show More Colors' : 'Show Less Colors';
            checkMobileColors();
        });

        // Check on load and resize
        checkMobileColors();
        window.addEventListener('resize', checkMobileColors);
    }

    updateSelectedColor(colorData) {
        this.state.selectedColor = colorData.COLOR_NAME || '';
        this.state.selectedColorData = colorData;
        
        // Update the selected color indicator
        const indicator = this.container.querySelector('.upd-selected-color');
        if (indicator) {
            const swatch = indicator.querySelector('.mini-color-swatch');
            const name = indicator.querySelector('.color-name');
            
            if (swatch) {
                swatch.style = this.getColorSwatchStyle();
                swatch.title = this.state.selectedColor;
            }
            if (name) {
                name.textContent = this.state.selectedColor;
            }
        }
        
        // Update the product image if we have a new one
        if (colorData.MAIN_IMAGE_URL) {
            const mainImage = this.container.querySelector('#product-image-main');
            if (mainImage) {
                mainImage.src = colorData.MAIN_IMAGE_URL;
                mainImage.alt = `${this.state.productTitle} - ${this.state.selectedColor}`;
            }
        }
    }

    initializeSubComponents() {
        // Initialize the universal image gallery if needed
        if (this.config.enableGallery && window.UniversalImageGallery) {
            setTimeout(() => {
                const galleryContainer = document.getElementById('product-image-gallery');
                if (galleryContainer) {
                    // Check if gallery is already initialized
                    if (!galleryContainer.hasAttribute('data-gallery-initialized')) {
                        new UniversalImageGallery('product-image-gallery', {
                            enableZoom: true,
                            enableThumbnails: true,
                            enableLoading: true
                        });
                        galleryContainer.setAttribute('data-gallery-initialized', 'true');
                    }
                } else {
                    console.warn('[UniversalProductDisplay] Gallery container not found');
                }
            }, 100);
        }
    }
    
    // Update info box content dynamically
    updateInfoBox(content) {
        const infoBox = this.container.querySelector('.upd-info-box p');
        if (infoBox) {
            infoBox.textContent = content;
        } else {
            console.warn('[UniversalProductDisplay] Info box element not found');
        }
    }
}

// Export for use
window.UniversalProductDisplay = UniversalProductDisplay;