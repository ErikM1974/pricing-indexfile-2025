/**
 * Product Info Component
 * Displays product title, description, and details
 */

export class ProductInfo {
    constructor(container) {
        this.container = container;
    }

    update(product) {
        if (!product) {
            this.container.innerHTML = '';
            return;
        }

        const selectedColor = product.colors[0];
        const priceEstimate = this.calculatePriceEstimate(product.styleNumber);

        this.container.innerHTML = `
            <h2 class="product-title">${this.escapeHtml(product.title)}</h2>
            <div class="product-style">Style: ${this.escapeHtml(product.styleNumber)}</div>
            
            ${priceEstimate ? `
                <div class="price-estimate">
                    <span class="price-label">Estimated Price:</span>
                    <span class="price-value">${priceEstimate}</span>
                    <span class="price-note">(24pc with embroidery)</span>
                </div>
            ` : ''}
            
            <div class="selected-color">
                <strong>Selected Color:</strong> 
                <span id="selected-color-name">${this.escapeHtml(selectedColor.colorName)}</span>
            </div>
            
            <div class="product-description">
                <h3>Description</h3>
                <p>${this.formatDescription(product.description)}</p>
            </div>
            
            <div class="product-actions">
                <button class="copy-info-btn" onclick="window.copyProductInfo()">
                    📋 Copy Product Info
                </button>
            </div>
        `;

        // Add copy function to window
        window.copyProductInfo = () => this.copyProductInfo(product);
    }

    calculatePriceEstimate(styleNumber) {
        // Basic price estimates based on common styles
        // This is a simplified version - could be enhanced with actual pricing data
        const baseEstimates = {
            'PC': '$8-12',      // Basic tees
            'C1': '$12-16',     // Caps
            'ST': '$18-24',     // Sport-Tek
            'F2': '$22-28',     // Fleece
            'J': '$35-45'       // Jackets
        };

        // Find matching prefix
        for (const [prefix, price] of Object.entries(baseEstimates)) {
            if (styleNumber.toUpperCase().startsWith(prefix)) {
                return price;
            }
        }

        return null; // No estimate available
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
        const selectedColor = product.colors.find(c => 
            c.colorName === document.getElementById('selected-color-name')?.textContent
        ) || product.colors[0];

        const info = `
Product: ${product.title}
Style: ${product.styleNumber}
Color: ${selectedColor.colorName}
${this.calculatePriceEstimate(product.styleNumber) ? 
    `Estimated Price: ${this.calculatePriceEstimate(product.styleNumber)} (24pc with embroidery)` : ''}

Description:
${product.description}
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