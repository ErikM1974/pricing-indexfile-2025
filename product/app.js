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
import { InventoryDisplay } from './components/inventory.js';
import { ProductInfo } from './components/info.js';
import { ColorSwatches } from './components/swatches.js';

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
        // Initialize search component
        this.components.search = new ProductSearch(
            document.getElementById('product-search'),
            this.handleProductSelect
        );

        // Initialize gallery component
        this.components.gallery = new ProductGallery(
            document.getElementById('product-gallery')
        );

        // Initialize product info component
        this.components.info = new ProductInfo(
            document.getElementById('product-info')
        );

        // Initialize color swatches component
        this.components.swatches = new ColorSwatches(
            document.getElementById('color-swatches'),
            this.handleColorSelect
        );

        // Initialize pricing cards component
        this.components.pricing = new PricingCards(
            document.querySelector('.pricing-cards')
        );

        // Initialize inventory display component
        this.components.inventory = new InventoryDisplay(
            document.getElementById('inventory-table')
        );
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
                document.getElementById('style-search').focus();
            }
        });
    }

    async checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        
        if (styleNumber) {
            await this.loadProduct(styleNumber);
        }
    }

    async handleProductSelect(styleNumber) {
        await this.loadProduct(styleNumber);
    }

    async loadProduct(styleNumber) {
        try {
            this.showLoading(true);
            
            // Fetch product data
            const productData = await this.api.getProduct(styleNumber);
            
            if (!productData || !productData.colors || productData.colors.length === 0) {
                throw new Error('Product not found');
            }

            // Update state
            this.state.set('product', productData);
            this.state.set('selectedColor', productData.colors[0]);
            
            // Update URL
            this.updateUrl(styleNumber, productData.colors[0].catalogColor);
            
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
        document.getElementById('pricing-options').classList.remove('hidden');
        document.getElementById('inventory-display').classList.remove('hidden');

        // Update components
        this.components.gallery.update(product.colors[0]);
        this.components.info.update(product);
        this.components.swatches.update(product.colors);
        this.components.pricing.update(product.styleNumber, product.colors[0].catalogColor);
    }

    async handleColorSelect(color) {
        this.state.set('selectedColor', color);
    }

    async updateColorSelection(color) {
        const product = this.state.get('product');
        
        // Update gallery
        this.components.gallery.update(color);
        
        // Update pricing links
        this.components.pricing.update(product.styleNumber, color.catalogColor);
        
        // Load inventory
        await this.loadInventory(product.styleNumber, color.catalogColor);
        
        // Update URL
        this.updateUrl(product.styleNumber, color.catalogColor);
    }

    async loadInventory(styleNumber, colorCode) {
        try {
            const inventory = await this.api.getInventory(styleNumber, colorCode);
            this.components.inventory.update(inventory);
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.components.inventory.showError('Failed to load inventory');
        }
    }

    updateUrl(styleNumber, colorCode) {
        const url = new URL(window.location);
        url.searchParams.set('StyleNumber', styleNumber);
        url.searchParams.set('COLOR', colorCode);
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new ProductPageApp();
    app.init();
});