/**
 * Northwest Custom Apparel - Modern Product Catalog Application
 * 
 * This application uses the new API-driven search endpoint instead of Caspio DataPages
 * for improved performance and better user experience.
 * 
 * API ENDPOINT:
 * - Products Search: GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/search
 * 
 * @author Northwest Custom Apparel
 * @version 3.0
 */

// Load required modules
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

class CatalogApp {
    constructor() {
        this.productSearch = null;
        this.productFilters = null;
        this.productGrid = null;
        this.isInitialized = false;
        
        // Top sellers list (maintained from previous version)
        this.topSellerStyles = [
            '18500', '5186', '8000', '996M', 'C114', 'C112', 'CP90', 
            'CSF300', 'CTK121', 'NKDC1963', 'CT104670', 'PC450'
        ];
        
        // Category data (maintained from previous version)
        this.categoryData = {
            "T-Shirts": ["Ring Spun", "100% Cotton", "6-6.1 100% Cotton", "Long Sleeve", "Fashion"],
            "Polos/Knits": ["Ladies", "Performance", "Easy Care", "Fashion", "Tall"],
            "Sweatshirts/Fleece": ["Ladies", "Performance", "Crewnecks", "Hoodie", "Youth"],
            "Caps": ["Performance/ Athletic", "Visors", "Stretch-to-Fit", "Youth", "Fashion"],
            "Activewear": ["Ladies", "Youth", "Performance", "Basketball", "Pants & Shorts"],
            "Outerwear": ["Ladies", "Athletic/Warm-Ups", "Corporate Jackets", "Tall", "Insulated Jackets"],
            "Bags": ["Golf Bags", "Travel Bags", "Rolling Bags", "Backpacks", "Totes"],
            "Accessories": ["Other", "Aprons", "Blankets", "Scarves/Gloves", "Robes/Towels"],
            "Workwear": ["Medical/Scrubs", "Stain/Soil Resistant", "Aprons", "T-Shirts", "Industrial Work Shirts"],
            "Woven Shirts": ["Ladies", "Premium Wovens", "Workwear", "Denim", "Cotton"],
            "Ladies": ["Polos/Knits", "Outerwear", "Activewear", "Fashion", "T-Shirts"],
            "Youth": ["Sweatshirts/Fleece", "T-Shirts", "Bottoms", "Activewear", "Outerwear"]
        };
    }
    
    async init() {
        if (this.isInitialized) return;
        
        try {
            // Load search components if not already loaded
            if (typeof ProductSearch === 'undefined') {
                await loadScript('/shared_components/js/product-search.js');
            }
            if (typeof ProductFilters === 'undefined') {
                await loadScript('/shared_components/js/product-filters.js');
            }
            if (typeof ProductGrid === 'undefined') {
                await loadScript('/shared_components/js/product-grid.js');
            }
            
            // Initialize components
            this.initializeComponents();
            
            // Setup navigation
            this.setupNavigation();
            
            // Setup search
            this.setupSearch();
            
            // Load initial content
            await this.loadInitialContent();
            
            // Handle URL state
            this.handleURLState();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Catalog app initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize catalog app:', error);
        }
    }
    
    initializeComponents() {
        // Initialize search module
        this.productSearch = new ProductSearch();
        
        // Get container elements
        const filtersContainer = document.getElementById('filtersContainer');
        const gridContainer = document.getElementById('productsContainer');
        
        // Create containers if they don't exist
        if (!filtersContainer) {
            const main = document.querySelector('.content') || document.querySelector('main');
            if (main) {
                // Create filter sidebar
                const filterDiv = document.createElement('div');
                filterDiv.id = 'filtersContainer';
                filterDiv.className = 'filters-sidebar';
                main.insertBefore(filterDiv, main.firstChild);
                
                // Initialize filters
                this.productFilters = new ProductFilters(filterDiv, this.productSearch);
            }
        } else {
            this.productFilters = new ProductFilters(filtersContainer, this.productSearch);
        }
        
        if (!gridContainer) {
            const main = document.querySelector('.content') || document.querySelector('main');
            if (main) {
                // Find or create results section
                let resultsSection = document.querySelector('.results-section');
                if (!resultsSection) {
                    resultsSection = document.createElement('div');
                    resultsSection.className = 'results-section';
                    main.appendChild(resultsSection);
                }
                
                // Create grid container
                const gridDiv = document.createElement('div');
                gridDiv.id = 'productsContainer';
                resultsSection.appendChild(gridDiv);
                
                // Initialize grid
                this.productGrid = new ProductGrid(gridDiv, this.productSearch);
            }
        } else {
            this.productGrid = new ProductGrid(gridContainer, this.productSearch);
        }
    }
    
    setupNavigation() {
        // Setup category sidebar
        this.renderCategorySidebar();
        
        // Setup mega menu
        this.renderMegaMenu();
        
        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.toggle('active');
                }
            });
        }
        
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            });
        }
    }
    
    renderCategorySidebar() {
        const categoryList = document.getElementById('categoryList');
        if (!categoryList) return;
        
        categoryList.innerHTML = Object.keys(this.categoryData).map(category => `
            <li class="category-item">
                <a href="#" class="category-link" data-category="${category}">
                    ${category}
                </a>
            </li>
        `).join('');
        
        // Add click handlers
        categoryList.addEventListener('click', async (e) => {
            e.preventDefault();
            const link = e.target.closest('.category-link');
            if (link) {
                const category = link.dataset.category;
                await this.searchByCategory(category);
                
                // Update active state
                categoryList.querySelectorAll('.category-link').forEach(l => {
                    l.classList.toggle('active', l === link);
                });
            }
        });
    }
    
    renderMegaMenu() {
        const navCategories = document.getElementById('navCategories');
        if (!navCategories) return;
        
        // Create columns of categories for mega menu
        const categories = Object.entries(this.categoryData);
        const columnsCount = 4;
        const itemsPerColumn = Math.ceil(categories.length / columnsCount);
        
        let html = '';
        for (let i = 0; i < columnsCount; i++) {
            const columnCategories = categories.slice(i * itemsPerColumn, (i + 1) * itemsPerColumn);
            
            html += '<div class="dropdown-column">';
            columnCategories.forEach(([category, subcategories]) => {
                html += `
                    <div class="category-group">
                        <h4><a href="#" class="category-main-link" data-category="${category}">${category}</a></h4>
                        <ul class="subcategory-list">
                            ${subcategories.slice(0, 5).map(sub => `
                                <li><a href="#" class="subcategory-link" data-category="${category}" data-subcategory="${sub}">${sub}</a></li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        navCategories.innerHTML = html;
        
        // Add click handlers for mega menu
        navCategories.addEventListener('click', async (e) => {
            e.preventDefault();
            const link = e.target.closest('a');
            if (link) {
                const category = link.dataset.category;
                const subcategory = link.dataset.subcategory;
                
                if (subcategory) {
                    await this.searchByCategoryAndSubcategory(category, subcategory);
                } else {
                    await this.searchByCategory(category);
                }
                
                // Close mega menu
                const dropdown = link.closest('.nav-dropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                    setTimeout(() => {
                        dropdown.style.display = '';
                    }, 100);
                }
            }
        });
    }
    
    setupSearch() {
        const searchInput = document.getElementById('navSearchInput');
        const searchBtn = document.getElementById('navSearchBtn');
        
        if (searchInput) {
            // Debounced search
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length >= 2) {
                    searchTimeout = setTimeout(() => {
                        this.performSearch(query);
                    }, 300);
                }
            });
            
            // Search on enter
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(searchTimeout);
                    this.performSearch(e.target.value.trim());
                }
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                if (searchInput) {
                    this.performSearch(searchInput.value.trim());
                }
            });
        }
    }
    
    async loadInitialContent() {
        // Show loading state
        this.showHomepage();
        
        // Load featured products
        await this.loadFeaturedProducts();
        
        // Load top sellers
        await this.loadTopSellers();
    }
    
    async loadFeaturedProducts() {
        try {
            const data = await this.productSearch.getFeatured(12);
            this.displayFeaturedProducts(data.products);
        } catch (error) {
            console.error('Failed to load featured products:', error);
        }
    }
    
    async loadTopSellers() {
        const quickButtons = document.querySelector('.quick-buttons');
        if (!quickButtons) return;
        
        try {
            // For now, use the featured products as top sellers
            // In production, you'd filter by the topSellerStyles array
            const data = await this.productSearch.getFeatured(8);
            
            quickButtons.innerHTML = data.products.map(product => `
                <button class="quick-button" data-style="${product.styleNumber}">
                    <img src="${product.images?.thumbnail || ''}" alt="${product.productName}" loading="lazy">
                    <span class="button-label">${product.productName}</span>
                    <span class="button-style">Style: ${product.styleNumber}</span>
                </button>
            `).join('');
            
            // Add click handlers
            quickButtons.addEventListener('click', (e) => {
                const button = e.target.closest('.quick-button');
                if (button) {
                    const style = button.dataset.style;
                    this.performSearch(style);
                }
            });
            
        } catch (error) {
            console.error('Failed to load top sellers:', error);
            quickButtons.innerHTML = '<p>Failed to load top sellers</p>';
        }
    }
    
    displayFeaturedProducts(products) {
        const container = document.querySelector('.featured-products');
        if (!container) return;
        
        container.innerHTML = products.map(product => `
            <div class="featured-product-card">
                <img src="${product.images?.thumbnail || ''}" alt="${product.productName}">
                <h4>${product.productName}</h4>
                <p class="product-price">$${(product.pricing?.current || 0).toFixed(2)}</p>
            </div>
        `).join('');
    }
    
    async performSearch(query) {
        if (!query) return;
        
        // Update search state
        this.productSearch.setQuery(query);
        
        // Show loading
        this.productGrid.showLoading();
        
        // Hide homepage, show results
        this.hideHomepage();
        this.showResults();
        
        try {
            // Execute search
            const data = await this.productSearch.search();
            
            // Update UI
            this.productGrid.displayProducts(data);
            this.productFilters.updateFacets(data.facets);
            
            // Update URL
            this.updateURL();
            
        } catch (error) {
            console.error('Search failed:', error);
            this.productGrid.hideLoading();
        } finally {
            this.productGrid.hideLoading();
        }
    }
    
    async searchByCategory(category) {
        // Reset search and set category filter
        this.productSearch.resetFilters();
        this.productSearch.setFilter('category', [category]);
        
        // Show loading
        this.productGrid.showLoading();
        
        // Hide homepage, show results
        this.hideHomepage();
        this.showResults();
        
        // Update title
        this.updateResultsTitle(`${category}`);
        
        try {
            const data = await this.productSearch.search();
            this.productGrid.displayProducts(data);
            this.productFilters.updateFacets(data.facets);
            this.updateURL();
        } catch (error) {
            console.error('Category search failed:', error);
        } finally {
            this.productGrid.hideLoading();
        }
    }
    
    async searchByCategoryAndSubcategory(category, subcategory) {
        // Reset and set filters
        this.productSearch.resetFilters();
        this.productSearch.setFilter('category', [category]);
        this.productSearch.setFilter('subcategory', [subcategory]);
        
        // Show loading
        this.productGrid.showLoading();
        
        // Hide homepage, show results
        this.hideHomepage();
        this.showResults();
        
        // Update title
        this.updateResultsTitle(`${category} > ${subcategory}`);
        
        try {
            const data = await this.productSearch.search();
            this.productGrid.displayProducts(data);
            this.productFilters.updateFacets(data.facets);
            this.updateURL();
        } catch (error) {
            console.error('Subcategory search failed:', error);
        } finally {
            this.productGrid.hideLoading();
        }
    }
    
    setupEventListeners() {
        // Listen for filter changes
        if (this.productFilters) {
            this.productFilters.container.addEventListener('filtersChanged', async () => {
                await this.performSearch(this.productSearch.state.query);
            });
        }
        
        // Listen for sort changes
        if (this.productGrid) {
            this.productGrid.container.addEventListener('sortChanged', async () => {
                await this.performSearch(this.productSearch.state.query);
            });
            
            // Listen for page changes
            this.productGrid.container.addEventListener('pageChanged', async () => {
                await this.performSearch(this.productSearch.state.query);
                window.scrollTo(0, 0);
            });
            
            // Listen for quick view
            this.productGrid.container.addEventListener('quickView', (e) => {
                this.showQuickView(e.detail);
            });
        }
        
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            this.handleURLState();
        });
    }
    
    handleURLState() {
        const params = new URLSearchParams(window.location.search);
        
        if (params.toString()) {
            this.productSearch.loadStateFromURL(params.toString());
            this.performSearch(this.productSearch.state.query);
        }
    }
    
    updateURL() {
        const stateString = this.productSearch.getStateForURL();
        const newURL = stateString ? `?${stateString}` : window.location.pathname;
        
        if (window.location.search !== (stateString ? `?${stateString}` : '')) {
            window.history.pushState({}, '', newURL);
        }
    }
    
    showHomepage() {
        const homepage = document.querySelector('.homepage-sections');
        const results = document.querySelector('.results-section');
        const filters = document.querySelector('#filtersContainer');
        
        if (homepage) homepage.style.display = '';
        if (results) results.style.display = 'none';
        if (filters) filters.style.display = 'none';
    }
    
    hideHomepage() {
        const homepage = document.querySelector('.homepage-sections');
        if (homepage) homepage.style.display = 'none';
    }
    
    showResults() {
        const results = document.querySelector('.results-section');
        const filters = document.querySelector('#filtersContainer');
        
        if (results) results.style.display = '';
        if (filters) filters.style.display = '';
    }
    
    updateResultsTitle(title) {
        const titleElement = document.querySelector('.results-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
    
    showQuickView(styleNumber) {
        // TODO: Implement quick view modal
        console.log('Quick view for:', styleNumber);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.catalogApp = new CatalogApp();
    window.catalogApp.init();
});