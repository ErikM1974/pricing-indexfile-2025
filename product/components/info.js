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

        // Show initial content with loading price
        this.container.innerHTML = `
            <h2 class="product-title">${this.escapeHtml(product.title || product.productTitle || product.PRODUCT_TITLE || product.styleNumber)}</h2>
            <div class="product-style">Style: ${this.escapeHtml(product.styleNumber)}</div>
            
            <div class="price-estimate" id="price-estimate-container">
                <span class="price-label">Estimated Price:</span>
                <span class="price-value" id="estimated-price">Calculating...</span>
                <span class="price-note">(24pc with basic logo)</span>
            </div>
            
            <div class="selected-color">
                <strong>Selected Color:</strong> 
                <span id="selected-color-name">${this.escapeHtml(colorName)}</span>
            </div>
            
            <div class="product-description">
                <h3>Description</h3>
                <p>${this.formatDescription(product.description || product.PRODUCT_DESCRIPTION || '')}</p>
            </div>
            
            <div class="product-actions">
                <button class="copy-info-btn" onclick="window.copyProductInfo()">
                    📋 Copy Product Info
                </button>
            </div>
        `;

        // Add copy function to window
        window.copyProductInfo = () => this.copyProductInfo(product);

        // Fetch and calculate estimated price
        this.calculateAndDisplayPrice(product.styleNumber);
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
                
                // Calculate price with 40% margin: cost / 0.60
                const priceWithMargin = lowestCost / 0.60;
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