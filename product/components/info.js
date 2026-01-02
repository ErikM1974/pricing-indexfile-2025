/**
 * Product Info Component
 * Displays product title, description, and details
 */

export class ProductInfo {
    constructor(container, api) {
        this.container = container;
        this.api = api;
        this.estimatedPrice = null;
    }

    async update(product) {
        if (!product) {
            this.container.innerHTML = '';
            return;
        }

        const selectedColor = product.colors[0];
        const colorName = selectedColor.COLOR_NAME || selectedColor.colorName || selectedColor.color_name || 'N/A';

        // Show initial content with enhanced layout
        this.container.innerHTML = `
            <div class="product-header">
                <div class="product-header-text">
                    <h2 class="product-title">${this.escapeHtml(product.title || product.productTitle || product.PRODUCT_TITLE || product.styleNumber)}</h2>
                    <div class="product-style">Style: ${this.escapeHtml(product.styleNumber)}</div>
                </div>
                ${product.colors[0].BRAND_LOGO_IMAGE ? `
                    <div class="brand-logo">
                        <img src="${this.escapeHtml(product.colors[0].BRAND_LOGO_IMAGE)}" alt="${this.escapeHtml(product.BRAND_NAME || 'Brand Logo')}" />
                    </div>
                ` : ''}
            </div>

            <!-- Product Description -->
            ${product.description || product.PRODUCT_DESCRIPTION ? `
                <div class="product-description-text">
                    ${this.escapeHtml(product.description || product.PRODUCT_DESCRIPTION)}
                </div>
            ` : ''}
        `;

        // Store product reference for later use
        this.currentProduct = product;
        this.currentSelectedColor = selectedColor;

        // Render Check Inventory button in the new location (below thumbnails)
        this.renderInventoryButton(product.styleNumber, selectedColor);

        // Fetch and calculate estimated price
        this.calculateAndDisplayPrice(product.styleNumber);
    }

    renderInventoryButton(styleNumber, selectedColor) {
        const container = document.getElementById('inventory-button-container');
        if (!container) return;

        const catalogColor = selectedColor.CATALOG_COLOR || selectedColor.catalogColor || selectedColor.catalog_color || 'NA';

        container.innerHTML = `
            <button class="inventory-button" onclick="window.checkInventoryDetails('${this.escapeHtml(styleNumber)}', '${this.escapeHtml(catalogColor)}')">
                <i class="fas fa-warehouse"></i>
                Check Inventory & Warehouse Locations
            </button>
        `;
    }

    async calculateAndDisplayPrice(styleNumber) {
        try {
            console.log('Fetching base costs for:', styleNumber);
            const baseCosts = await this.api.getBaseItemCosts(styleNumber);
            console.log('Base costs response:', baseCosts);
            
            // Check for different response formats
            let costs = [];
            if (baseCosts && baseCosts.baseCosts) {
                // Original format: {baseCosts: {...}}
                costs = Object.values(baseCosts.baseCosts);
            } else if (baseCosts && baseCosts.prices) {
                // New format: {prices: {...}}
                costs = Object.values(baseCosts.prices);
            }
            
            if (costs.length > 0) {
                console.log('All costs:', costs);
                const lowestCost = Math.min(...costs);
                console.log('Lowest cost:', lowestCost);
                
                // Calculate price with 43% margin (2026) - synced with API MarginDenominator
                const priceWithMargin = lowestCost / 0.57;
                console.log('Price with margin:', priceWithMargin);
                
                // Add $15 for basic logo embroidery
                const estimatedPrice = priceWithMargin + 15.00;
                console.log('Final estimated price before rounding:', estimatedPrice);
                
                // Round up to nearest dollar
                const roundedPrice = Math.ceil(estimatedPrice);
                console.log('Rounded price:', roundedPrice);
                
                // Format and display the price
                this.estimatedPrice = roundedPrice.toFixed(0);
                const priceElement = document.getElementById('estimated-price');
                if (priceElement) {
                    priceElement.textContent = `$${this.estimatedPrice}`;
                    console.log('Price displayed:', this.estimatedPrice);
                } else {
                    console.error('Price element not found!');
                }
            } else {
                console.error('No pricing data found in response:', baseCosts);
                const priceElement = document.getElementById('estimated-price');
                if (priceElement) {
                    priceElement.textContent = 'N/A';
                }
            }
        } catch (error) {
            console.error('Failed to calculate estimated price:', error);
            const priceElement = document.getElementById('estimated-price');
            if (priceElement) {
                priceElement.textContent = 'N/A';
            }
        }
    }


    formatDescription(description) {
        if (!description) return 'No description available.';
        
        // Convert line breaks to paragraphs
        return description
            .split('\n')
            .filter(line => line.trim())
            .map(line => this.escapeHtml(line))
            .join('<br>');
    }

    getProductDescription() {
        if (!this.currentProduct) return '';
        return this.currentProduct.description || this.currentProduct.PRODUCT_DESCRIPTION || 'No description available.';
    }

    copyProductInfo(product) {
        const selectedColorName = document.getElementById('selected-color-name')?.textContent;
        const selectedColor = product.colors.find(c => {
            const colorName = c.COLOR_NAME || c.colorName || c.color_name;
            return colorName === selectedColorName;
        }) || product.colors[0];
        
        const colorName = selectedColor.COLOR_NAME || selectedColor.colorName || selectedColor.color_name || 'N/A';
        const title = product.title || product.productTitle || product.PRODUCT_TITLE || product.styleNumber;
        const description = product.description || product.PRODUCT_DESCRIPTION || 'No description available';

        const info = `
Product: ${title}
Style: ${product.styleNumber}
Color: ${colorName}
${this.estimatedPrice ? 
    `Estimated Price: $${this.estimatedPrice} (24pc with basic logo)` : 'Estimated Price: Calculating...'}

Description:
${description}
        `.trim();

        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(info)
                .then(() => {
                    this.showCopySuccess();
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                    this.fallbackCopy(info);
                });
        } else {
            this.fallbackCopy(info);
        }
    }

    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.showCopySuccess();
    }

    showCopySuccess() {
        const btn = this.container.querySelector('.copy-info-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('success');
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('success');
        }, 2000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}