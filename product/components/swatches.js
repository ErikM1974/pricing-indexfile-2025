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
        this.showAll = false;
        this.initialDisplayCount = 10; // Show 10 colors initially
    }

    update(colors) {
        if (!colors || colors.length === 0) {
            this.container.innerHTML = '';
            return;
        }

        this.colors = colors;
        this.selectedColor = colors[0];
        this.showAll = false; // Reset when colors update
        this.render();
    }

    render() {
        const selectedColorName = this.selectedColor ?
            (this.selectedColor.COLOR_NAME || this.selectedColor.colorName || this.selectedColor.color_name || 'Unknown') :
            '';

        const displayColors = this.showAll ? this.colors : this.colors.slice(0, this.initialDisplayCount);
        const hasMore = this.colors.length > this.initialDisplayCount;

        this.container.innerHTML = `
            <h3>Available Colors (${this.colors.length})</h3>
            <div class="selected-color-display">
                <span class="checkmark">✓</span>
                <span class="selected-label">Color selected:</span>
                <span class="selected-name">${selectedColorName}</span>
            </div>
            <div class="swatches-grid" id="swatches-grid">
                ${displayColors.map((color, index) => this.createSwatchHtml(color, this.colors.indexOf(color))).join('')}
            </div>
            ${hasMore ? `
                <button class="show-all-colors-btn" id="toggle-colors-btn">
                    ${this.showAll ?
                        '<i class="fas fa-chevron-up"></i> Show Less Colors' :
                        `<i class="fas fa-chevron-down"></i> Show All ${this.colors.length} Colors`
                    }
                </button>
            ` : ''}
        `;

        // Add event listeners for swatches
        this.container.querySelectorAll('.color-swatch').forEach((swatch) => {
            const colorIndex = parseInt(swatch.dataset.colorIndex);
            swatch.addEventListener('click', () => {
                this.selectColor(this.colors[colorIndex]);
            });
        });

        // Add event listener for toggle button
        const toggleBtn = this.container.querySelector('#toggle-colors-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleShowAll();
            });
        }
    }

    toggleShowAll() {
        this.showAll = !this.showAll;
        this.render();
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
                 data-color-index="${index}"
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