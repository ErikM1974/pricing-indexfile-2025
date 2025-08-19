/**
 * Product Page Application
 * Main entry point for the product details page
 */

// Import all modules
import { API } from './services/api.js';
import { AppState } from './services/state.js';
import { ProductSearch } from './components/search.js';
import { ProductGallery } from './components/gallery.js';
import { PricingCards } from './components/pricing.js';
import { InventorySummary } from './components/inventory-summary.js';
import { ProductInfo } from './components/info.js';
import { ColorSwatches } from './components/swatches.js';
import { DecorationSelector } from './components/decoration-selector.js';
import { QuoteModal } from './components/quote-modal.js';

// Initialize application
class ProductPageApp {
    constructor() {
        this.state = new AppState();
        this.api = new API();
        this.components = {};
        
        // Bind methods
        this.handleProductSelect = this.handleProductSelect.bind(this);
        this.handleColorSelect = this.handleColorSelect.bind(this);
    }

    async init() {
        try {
            // Initialize components
            this.initializeComponents();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Check for URL parameters
            await this.checkUrlParameters();
            
            console.log('Product page initialized successfully');
        } catch (error) {
            console.error('Failed to initialize product page:', error);
            this.showError('Failed to initialize page. Please refresh.');
        }
    }

    initializeComponents() {
        // Initialize search component - pass header search container
        const headerSearchContainer = document.querySelector('.header-search');
        this.components.search = new ProductSearch(
            headerSearchContainer,
            this.handleProductSelect
        );

        // Initialize gallery component with separate thumbnail container
        this.components.gallery = new ProductGallery(
            document.getElementById('product-gallery'),
            document.getElementById('product-thumbnails')
        );

        // Initialize product info component
        this.components.info = new ProductInfo(
            document.getElementById('product-info'),
            this.api
        );

        // Initialize color swatches component
        this.components.swatches = new ColorSwatches(
            document.getElementById('color-swatches'),
            this.handleColorSelect
        );

        // Initialize decoration selector component
        this.components.decorationSelector = new DecorationSelector(
            document.getElementById('decoration-selector')
        );

        // Initialize pricing cards component (hidden but still functional)
        this.components.pricing = new PricingCards(
            document.querySelector('.pricing-cards')
        );

        // Initialize inventory summary component (hidden but still functional)
        this.components.inventory = new InventorySummary(
            document.getElementById('inventory-table')
        );
        
        // Initialize quote modal
        this.components.quoteModal = new QuoteModal();
    }

    setupEventListeners() {
        // Listen for state changes
        this.state.subscribe('product', (product) => {
            if (product) {
                this.updateProductDisplay(product);
            }
        });

        this.state.subscribe('selectedColor', (color) => {
            if (color && this.state.get('product')) {
                this.updateColorSelection(color);
            }
        });

        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const headerSearch = document.getElementById('header-style-search');
                if (headerSearch) {
                    headerSearch.focus();
                }
            }
        });
        
        // QUOTE-LISTENER: Temporarily disabled - uncomment when quote feature is ready
        // Listen for send quote button clicks
        /*
        document.addEventListener('click', (e) => {
            if (e.target.closest('#send-quote-btn')) {
                this.handleSendQuote();
            }
        });
        */
    }

    async checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        // Check for both 'style' (lowercase) and 'StyleNumber' (uppercase) for compatibility
        const styleNumber = urlParams.get('style') || urlParams.get('StyleNumber');
        const colorParam = urlParams.get('color') || urlParams.get('COLOR');
        
        if (styleNumber) {
            await this.loadProduct(styleNumber, colorParam);
        }
    }

    async handleProductSelect(styleNumber) {
        await this.loadProduct(styleNumber);
    }

    async loadProduct(styleNumber, requestedColorName = null) {
        try {
            this.showLoading(true);
            
            // Fetch product data
            const productData = await this.api.getProduct(styleNumber);
            console.log('Product data received:', productData);
            
            if (!productData || !productData.colors || productData.colors.length === 0) {
                throw new Error('Product not found or has no colors');
            }

            // Update state
            this.state.set('product', productData);
            
            // Check if we have colors and select the appropriate one
            if (productData.colors && productData.colors.length > 0) {
                let selectedColor = productData.colors[0]; // Default to first color
                
                // If a specific color was requested, try to find it
                if (requestedColorName) {
                    const foundColor = productData.colors.find(color => {
                        // Check various possible color name properties
                        const colorName = color.COLOR_NAME || color.colorName || color.color_name || color.name || '';
                        return colorName.toLowerCase() === requestedColorName.toLowerCase();
                    });
                    
                    if (foundColor) {
                        selectedColor = foundColor;
                        console.log('Found requested color:', requestedColorName);
                    } else {
                        console.log('Requested color not found:', requestedColorName, 'Using first color instead');
                    }
                }
                
                console.log('Selected color data:', selectedColor);
                
                // Check which property name is used for catalog color
                const catalogColor = selectedColor.CATALOG_COLOR || selectedColor.catalogColor || selectedColor.catalog_color || 'NA';
                console.log('Catalog color:', catalogColor);
                
                this.state.set('selectedColor', selectedColor);
                
                // Update URL
                this.updateUrl(styleNumber, catalogColor);
            }
            
        } catch (error) {
            console.error('Failed to load product:', error);
            this.showError(`Failed to load product: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    updateProductDisplay(product) {
        // Show product sections
        document.getElementById('product-display').classList.remove('hidden');
        
        // Update components
        const firstColor = product.colors[0];
        const catalogColor = firstColor.CATALOG_COLOR || firstColor.catalogColor || firstColor.catalog_color || 'NA';
        
        console.log('Updating product display with first color:', catalogColor);
        
        this.components.gallery.update(firstColor);
        this.components.info.update(product);
        this.components.swatches.update(product.colors);
        this.components.decorationSelector.update(product.styleNumber, catalogColor);
        
        // Update breadcrumb
        const breadcrumbProduct = document.getElementById('breadcrumb-product');
        if (breadcrumbProduct) {
            breadcrumbProduct.textContent = product.title || product.productTitle || product.PRODUCT_TITLE || product.styleNumber;
        }
        
        // Add product description at the end
        this.addProductDescription();
        
        // Add product resources (PDFs)
        this.addProductResources();
    }

    async handleColorSelect(color) {
        this.state.set('selectedColor', color);
    }

    async updateColorSelection(color) {
        if (!color) {
            console.error('No color selected');
            return;
        }
        
        const product = this.state.get('product');
        const catalogColor = color.CATALOG_COLOR || color.catalogColor || color.catalog_color || 'NA';
        console.log('Updating color selection:', catalogColor);
        
        // Update gallery
        this.components.gallery.update(color);
        
        // Re-initialize zoom after gallery update
        setTimeout(() => {
            if (window.NWCA && window.NWCA.ImageZoom) {
                window.NWCA.ImageZoom.init();
            }
        }, 500);
        
        // Update decoration selector
        this.components.decorationSelector.update(product.styleNumber, catalogColor);
        
        // Update product resources for new color
        this.addProductResources();
        
        // Load inventory
        await this.loadInventory(product.styleNumber, catalogColor);
        
        // Update URL
        this.updateUrl(product.styleNumber, catalogColor);
    }

    async loadInventory(styleNumber, colorCode) {
        try {
            const inventory = await this.api.getInventory(styleNumber, colorCode);
            this.components.inventory.update(inventory, styleNumber, colorCode);
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.components.inventory.showError('Failed to load inventory');
        }
    }

    updateUrl(styleNumber, colorCode) {
        const url = new URL(window.location);
        // Use lowercase parameters for consistency with catalog links
        url.searchParams.set('style', styleNumber);
        url.searchParams.set('color', colorCode);
        window.history.replaceState({}, '', url);
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.toggle('hidden', !show);
    }

    showError(message) {
        const errorEl = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        errorText.textContent = message;
        errorEl.classList.remove('hidden');
    }
    
    addProductDescription() {
        // Check if product info component has description
        if (this.components.info && this.components.info.getProductDescription) {
            const description = this.components.info.getProductDescription();
            
            // Find or create description container
            let descContainer = document.getElementById('product-description-section');
            if (!descContainer) {
                descContainer = document.createElement('div');
                descContainer.id = 'product-description-section';
                descContainer.className = 'product-description-section';
                
                const infoColumn = document.querySelector('.product-info-column');
                if (infoColumn) {
                    infoColumn.appendChild(descContainer);
                }
            }
            
            if (descContainer && description) {
                descContainer.innerHTML = `
                    <h3>Description</h3>
                    <p>${description}</p>
                `;
            }
        }
    }
    
    addProductResources() {
        const product = this.state.get('product');
        const selectedColor = this.state.get('selectedColor');
        
        if (!product || !selectedColor) return;
        
        // Check if we have any PDF links
        const hasSpecSheet = selectedColor.SPEC_SHEET;
        const hasDecorationSheet = selectedColor.DECORATION_SPEC_SHEET;
        
        if (!hasSpecSheet && !hasDecorationSheet) return;
        
        // Find or create resources container
        let resourcesContainer = document.getElementById('product-resources-section');
        if (!resourcesContainer) {
            resourcesContainer = document.createElement('div');
            resourcesContainer.id = 'product-resources-section';
            resourcesContainer.className = 'product-resources-section';
            
            const infoColumn = document.querySelector('.product-info-column');
            if (infoColumn) {
                infoColumn.appendChild(resourcesContainer);
            }
        }
        
        if (resourcesContainer) {
            let resourcesHTML = '<div class="resources-header">Product Resources:</div><div class="resources-links">';
            
            if (hasSpecSheet) {
                resourcesHTML += `
                    <a href="${selectedColor.SPEC_SHEET}" target="_blank" class="resource-link">
                        <i class="fas fa-file-pdf"></i>
                        Product Specifications
                    </a>
                `;
            }
            
            if (hasDecorationSheet) {
                resourcesHTML += `
                    <a href="${selectedColor.DECORATION_SPEC_SHEET}" target="_blank" class="resource-link">
                        <i class="fas fa-file-pdf"></i>
                        Decoration Guidelines
                    </a>
                `;
            }
            
            resourcesHTML += '</div>';
            resourcesContainer.innerHTML = resourcesHTML;
        }
    }
    
    handleSendQuote() {
        const product = this.state.get('product');
        const selectedColor = this.state.get('selectedColor');
        
        if (!product || !selectedColor) {
            alert('Please select a product first');
            return;
        }
        
        // Prepare product data for quote
        const quoteData = {
            productName: product.title || product.productTitle || product.PRODUCT_TITLE || product.styleNumber,
            styleNumber: product.styleNumber,
            productImage: selectedColor.MAIN_IMAGE_URL || selectedColor.FRONT_MODEL_IMAGE_URL || '',
            colorName: selectedColor.COLOR_NAME || selectedColor.colorName || 'N/A',
            sizes: product.AVAILABLE_SIZES || 'Contact for sizes',
            description: product.description || product.PRODUCT_DESCRIPTION || '',
            brandLogo: selectedColor.BRAND_LOGO_IMAGE || '',
            brandName: product.BRAND_NAME || '',
            allColors: product.colors || [],
            selectedColorIndex: product.colors ? product.colors.indexOf(selectedColor) : 0
        };
        
        // Open quote modal with product data
        this.components.quoteModal.open(quoteData);
    }
}

// Global function for inventory button
window.checkInventoryDetails = function(styleNumber, colorCode) {
    // Navigate to inventory details page
    window.location.href = `/inventory-details.html?style=${styleNumber}&color=${encodeURIComponent(colorCode)}`;
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new ProductPageApp();
    app.init();
});