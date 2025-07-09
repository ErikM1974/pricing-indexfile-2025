/**
 * Universal Header Component
 * A modular header that can be used across all pricing pages
 * Handles navigation, breadcrumbs, and dynamic product context
 */

const UniversalHeaderComponent = {
    // Default configuration
    defaultConfig: {
        phone: '253-922-5793',
        email: 'sales@nwcustomapparel.com',
        hours: '9AM-5PM',
        logoUrl: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20White%20Text.png?ver=1',
        showBackButton: true,
        showBreadcrumbs: true
    },

    // Page configurations
    pageConfigs: {
        'embroidery': {
            title: 'Embroidery Pricing',
            breadcrumbName: 'Embroidery Pricing',
            subtitle: 'Select a product to get started'
        },
        'cap-embroidery': {
            title: 'Cap Embroidery Pricing',
            breadcrumbName: 'Cap Embroidery Pricing',
            subtitle: 'Select a product to get started'
        },
        'dtg': {
            title: 'DTG Pricing',
            breadcrumbName: 'Direct to Garment Pricing',
            subtitle: 'Select a product to get started'
        },
        'screenprint': {
            title: 'Screen Print Pricing',
            breadcrumbName: 'Screen Print Pricing',
            subtitle: 'Select a product to get started'
        },
        'dtf': {
            title: 'DTF Pricing',
            breadcrumbName: 'Direct to Film Pricing',
            subtitle: 'Select a product to get started'
        }
    },

    /**
     * Initialize the header component
     */
    init() {
        console.log('[Universal Header] Initializing...');
        
        // Find container
        const container = document.getElementById('universal-header-container');
        if (!container) {
            console.log('[Universal Header] Container not found. This component may not be needed for this page.');
            // Not all pages need this component, so just exit quietly
            return;
        }

        // Detect page type
        const pageType = this.detectPageType();
        console.log('[Universal Header] Detected page type:', pageType);

        // Get configuration
        const config = this.buildConfig(pageType, container);
        
        // Render header
        container.innerHTML = this.generateHTML(config);
        
        // Setup dynamic updates
        this.setupDynamicUpdates();
        
        console.log('[Universal Header] Initialization complete');
    },

    /**
     * Detect which pricing page we're on
     */
    detectPageType() {
        // Check data attribute first
        const container = document.getElementById('universal-header-container');
        if (container?.dataset.pageType) {
            return container.dataset.pageType;
        }

        // Check URL path
        const path = window.location.pathname.toLowerCase();
        
        if (path.includes('embroidery-pricing')) {
            // Need to distinguish between regular and cap embroidery
            if (path.includes('cap-embroidery')) {
                return 'cap-embroidery';
            }
            return 'embroidery';
        }
        if (path.includes('dtg-pricing')) return 'dtg';
        if (path.includes('screen-print-pricing')) return 'screenprint';
        if (path.includes('dtf-pricing')) return 'dtf';
        
        // Default
        return 'embroidery';
    },

    /**
     * Build configuration for the header
     */
    buildConfig(pageType, container) {
        // Start with defaults
        const config = { ...this.defaultConfig };
        
        // Add page-specific config
        const pageConfig = this.pageConfigs[pageType] || this.pageConfigs['embroidery'];
        Object.assign(config, pageConfig);
        
        // Override with data attributes if present
        if (container.dataset.showBackButton !== undefined) {
            config.showBackButton = container.dataset.showBackButton !== 'false';
        }
        if (container.dataset.showBreadcrumbs !== undefined) {
            config.showBreadcrumbs = container.dataset.showBreadcrumbs !== 'false';
        }
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        config.styleNumber = urlParams.get('StyleNumber');
        config.color = urlParams.get('COLOR');
        
        // Update subtitle if we have product info
        if (config.styleNumber) {
            // Try to get product name from page
            const productTitle = document.getElementById('product-title-context');
            if (productTitle && productTitle.textContent !== 'Product Title') {
                config.subtitle = productTitle.textContent;
            } else {
                config.subtitle = `Style: ${config.styleNumber}`;
            }
        }
        
        return config;
    },

    /**
     * Generate the header HTML
     */
    generateHTML(config) {
        return `
            <header class="universal-header" id="universal-header">
                <!-- Top Bar -->
                <div class="header-top-bar">
                    <div class="header-top-bar-content">
                        <div class="contact-info">
                            <span>📞 ${config.phone}</span>
                            <span>✉️ ${config.email}</span>
                            <span>🕒 ${config.hours}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Main Header -->
                <div class="header-main">
                    <div class="header-main-content">
                        <div class="header-brand">
                            <img src="${config.logoUrl}" alt="NW Custom Apparel Logo" class="header-logo-img">
                        </div>
                        
                        <div class="header-nav-hub">
                            ${config.showBackButton ? this.generateBackButton(config) : ''}
                            
                            <div class="page-context">
                                <div class="page-context-title">${config.title}</div>
                                <div class="page-context-subtitle" id="current-product-context">
                                    ${config.subtitle}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Breadcrumbs -->
                ${config.showBreadcrumbs ? this.generateBreadcrumbs(config) : ''}
            </header>
        `;
    },

    /**
     * Generate back button HTML
     */
    generateBackButton(config) {
        let href = '#';
        if (config.styleNumber) {
            href = `/product.html?StyleNumber=${config.styleNumber}`;
            if (config.color) {
                href += `&COLOR=${encodeURIComponent(config.color)}`;
            }
        }
        
        return `
            <a id="back-to-product" href="${href}" class="back-to-product">
                <span class="back-icon">←</span> 
                <span>Back to Product</span>
            </a>
        `;
    },

    /**
     * Generate breadcrumbs HTML
     */
    generateBreadcrumbs(config) {
        let breadcrumbHTML = `
            <div class="header-breadcrumb">
                <div class="header-breadcrumb-content">
                    <nav class="header-breadcrumb-nav">
                        <a href="/" class="breadcrumb-link">Home</a>
                        <span class="breadcrumb-separator">›</span>
                        ${config.styleNumber ? 
                            `<a href="/product.html?StyleNumber=${config.styleNumber}${config.color ? '&COLOR=' + encodeURIComponent(config.color) : ''}" class="breadcrumb-link">Products</a>` : 
                            `<span>Products</span>`
                        }
        `;
        
        // Add product link if we have a style number
        if (config.styleNumber) {
            const productHref = `/product.html?StyleNumber=${config.styleNumber}`;
            breadcrumbHTML += `
                <span class="breadcrumb-separator">›</span>
                <a id="breadcrumb-product-link" href="${productHref}" class="breadcrumb-link">
                    <span id="breadcrumb-product">${config.styleNumber}</span>
                </a>
            `;
        }
        
        // Add current page
        breadcrumbHTML += `
                        <span class="breadcrumb-separator">›</span>
                        <span class="breadcrumb-current">${config.breadcrumbName}</span>
                    </nav>
                </div>
            </div>
        `;
        
        return breadcrumbHTML;
    },

    /**
     * Setup dynamic updates after header is rendered
     */
    setupDynamicUpdates() {
        // Listen for product title changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    this.updateProductContext();
                }
            });
        });

        const productTitle = document.getElementById('product-title-context');
        if (productTitle) {
            observer.observe(productTitle, { 
                childList: true, 
                characterData: true, 
                subtree: true 
            });
        }

        // Initial update
        this.updateProductContext();
    },

    /**
     * Update product context in header
     */
    updateProductContext() {
        const productTitle = document.getElementById('product-title-context');
        const headerContext = document.getElementById('current-product-context');
        
        if (productTitle && headerContext) {
            const titleText = productTitle.textContent.trim();
            if (titleText && titleText !== 'Product Title') {
                headerContext.textContent = titleText;
            }
        }
    },

    /**
     * Public method to update header dynamically
     */
    update(newConfig) {
        const container = document.getElementById('universal-header-container');
        if (container) {
            const pageType = this.detectPageType();
            const config = this.buildConfig(pageType, container);
            Object.assign(config, newConfig);
            container.innerHTML = this.generateHTML(config);
            this.setupDynamicUpdates();
        }
    }
};

// Auto-initialize on DOMContentLoaded if not already initialized
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        UniversalHeaderComponent.init();
    });
} else {
    // DOM already loaded
    UniversalHeaderComponent.init();
}

// Export for use in other scripts
window.UniversalHeaderComponent = UniversalHeaderComponent;