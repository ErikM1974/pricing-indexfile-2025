/**
 * Color Swatches Component
 * Handles color selection with visual swatches
 */

export class ColorSwatches {
    constructor(container, onColorSelect) {
        this.container = container;
        this.onColorSelect = onColorSelect;
        this.colors = [];
        this.selectedColor = null;
    }

    update(colors) {
        if (!colors || colors.length === 0) {
            this.container.innerHTML = '';
            return;
        }

        this.colors = colors;
        this.selectedColor = colors[0];
        this.render();
    }

    render() {
        const selectedColorName = this.selectedColor ? 
            (this.selectedColor.COLOR_NAME || this.selectedColor.colorName || this.selectedColor.color_name || 'Unknown') : 
            '';
        
        this.container.innerHTML = `
            <h3>Available Colors (${this.colors.length})</h3>
            <div class="selected-color-display">
                <span class="checkmark">✓</span>
                <span class="selected-label">Color selected:</span>
                <span class="selected-name">${selectedColorName}</span>
            </div>
            <div class="swatches-grid">
                ${this.colors.map((color, index) => this.createSwatchHtml(color, index)).join('')}
            </div>
        `;

        // Add event listeners
        this.container.querySelectorAll('.color-swatch').forEach((swatch, index) => {
            swatch.addEventListener('click', () => {
                this.selectColor(this.colors[index]);
            });
        });
    }

    createSwatchHtml(color, index) {
        const catalogColor = color.CATALOG_COLOR || color.catalogColor || color.catalog_color;
        const colorName = color.COLOR_NAME || color.colorName || color.color_name;
        const swatchImage = color.COLOR_SQUARE_IMAGE || color.colorSwatchImage || color.color_swatch_image;
        
        const isSelected = this.selectedColor && 
                          (this.selectedColor.CATALOG_COLOR === catalogColor || 
                           this.selectedColor.catalogColor === catalogColor);
        
        return `
            <div class="color-swatch ${isSelected ? 'selected' : ''}" 
                 data-color="${catalogColor}"
                 title="${colorName}">
                <div class="swatch-image" 
                     style="background-image: url('${swatchImage || ''}')">
                    ${!swatchImage ? this.createColorFallback(colorName) : ''}
                </div>
                <div class="swatch-name">${colorName}</div>
            </div>
        `;
    }

    createColorFallback(colorName) {
        // Handle undefined or empty color names
        if (!colorName) {
            return '<div class="fallback-color" style="background-color: #CCCCCC"></div>';
        }
        
        // Generate a color based on the color name for fallback
        const colorMap = {
            'black': '#000000',
            'white': '#FFFFFF',
            'navy': '#000080',
            'red': '#FF0000',
            'royal': '#4169E1',
            'grey': '#808080',
            'gray': '#808080',
            'green': '#008000',
            'blue': '#0000FF',
            'yellow': '#FFFF00',
            'orange': '#FFA500',
            'purple': '#800080',
            'pink': '#FFC0CB',
            'brown': '#A52A2A'
        };

        // Try to find a matching color
        const lowerName = colorName.toLowerCase();
        let bgColor = '#CCCCCC'; // Default gray
        
        for (const [key, value] of Object.entries(colorMap)) {
            if (lowerName.includes(key)) {
                bgColor = value;
                break;
            }
        }

        return `<div class="fallback-color" style="background-color: ${bgColor}"></div>`;
    }

    selectColor(color) {
        this.selectedColor = color;
        
        // Store scroll position to prevent jumping
        const scrollPos = window.scrollY;
        
        // Re-render to update the selected color display
        this.render();
        
        // Restore scroll position
        window.scrollTo(0, scrollPos);
        
        // Trigger callback
        if (this.onColorSelect) {
            this.onColorSelect(color);
        }
    }
}