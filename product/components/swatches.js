/**
 * Color Swatches Component
 * Handles color selection with visual swatches + inline inventory grid
 */

const SANMAR_API = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar';
const INVENTORY_CACHE = new Map();
const INVENTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class ColorSwatches {
    constructor(container, onColorSelect) {
        this.container = container;
        this.onColorSelect = onColorSelect;
        this.colors = [];
        this.selectedColor = null;
        this.showAll = false;
        this.initialDisplayCount = 10; // Show 10 colors initially
        this.styleNumber = null;
        this.inventoryData = null;
        this.inventoryVisible = true;
    }

    update(colors, styleNumber) {
        if (!colors || colors.length === 0) {
            this.container.innerHTML = '';
            return;
        }

        this.colors = colors;
        this.selectedColor = colors[0];
        this.styleNumber = styleNumber;
        this.showAll = false;
        this.render();
        // Auto-load inventory for the first color
        this.loadInventory();
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
        this.inventoryData = null; // Reset inventory for new color

        // Store scroll position to prevent jumping
        const scrollPos = window.scrollY;

        // Re-render to update the selected color display
        this.render();

        // Restore scroll position
        window.scrollTo(0, scrollPos);

        // Load inventory for new color
        this.loadInventory();

        // Trigger callback
        if (this.onColorSelect) {
            this.onColorSelect(color);
        }
    }

    async loadInventory() {
        if (!this.styleNumber || !this.selectedColor) return;

        const catalogColor = this.selectedColor.CATALOG_COLOR || this.selectedColor.catalogColor || '';
        const cacheKey = `${this.styleNumber}-${catalogColor}`;

        const externalContainer = document.getElementById('inline-inventory');

        // Check local cache
        const cached = INVENTORY_CACHE.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < INVENTORY_CACHE_TTL)) {
            this.inventoryData = cached.data;
            this.updateInventoryGrid();
            return;
        }

        // Show loading state
        if (externalContainer) {
            externalContainer.innerHTML = '<div class="inventory-loading"><i class="fas fa-spinner fa-spin"></i> Loading inventory...</div>';
        }

        try {
            const response = await fetch(`${SANMAR_API}/inventory/${encodeURIComponent(this.styleNumber)}?color=${encodeURIComponent(catalogColor)}`);
            if (!response.ok) throw new Error('Inventory fetch failed');
            const data = await response.json();
            this.inventoryData = data;
            INVENTORY_CACHE.set(cacheKey, { data, timestamp: Date.now() });
            this.updateInventoryGrid();
        } catch (error) {
            console.error('Inventory load failed:', error);
            if (externalContainer) {
                externalContainer.innerHTML = '<div class="inventory-error">Unable to load inventory</div>';
            }
        }
    }

    updateInventoryGrid() {
        const container = document.getElementById('inline-inventory');
        if (container) {
            container.innerHTML = this.renderInventoryGrid();
        }
    }

    renderInventoryGrid() {
        if (!this.inventoryData || !this.inventoryData.inventory || this.inventoryData.inventory.length === 0) {
            return '<div class="inventory-empty">No inventory data available</div>';
        }

        const inv = this.inventoryData.inventory;
        const colorName = this.selectedColor.COLOR_NAME || this.selectedColor.colorName || '';
        const swatchImage = this.selectedColor.COLOR_SQUARE_IMAGE || this.selectedColor.colorSwatchImage || '';

        // Get all warehouse names from first item (all items have same warehouses)
        const warehouses = inv[0].warehouses || [];

        // Build header row (sizes)
        const sizeHeaders = inv.map(item => `<th>${item.size}</th>`).join('');

        // Build warehouse rows
        const warehouseRows = warehouses.map(wh => {
            const cells = inv.map(item => {
                const whData = item.warehouses.find(w => w.id === wh.id);
                const qty = whData ? whData.qty : 0;
                const cellClass = qty === 0 ? 'stock-out' : qty < 50 ? 'stock-low' : 'stock-good';
                return `<td class="${cellClass}">${qty.toLocaleString()}</td>`;
            }).join('');
            return `<tr><td class="wh-name">${wh.name}</td>${cells}</tr>`;
        }).join('');

        // Build totals row
        const totalCells = inv.map(item => {
            const cls = item.totalQty === 0 ? 'stock-out' : item.totalQty < 50 ? 'stock-low' : 'stock-good';
            return `<td class="total-cell ${cls}">${item.totalQty.toLocaleString()}</td>`;
        }).join('');

        return `
            <div class="inventory-grid-container">
                <div class="inventory-grid-header">
                    <div class="inventory-header-left">
                        ${swatchImage ? `<img src="${swatchImage}" alt="${colorName}" class="inventory-header-swatch">` : ''}
                        <span class="inventory-header-color-name">${colorName}</span>
                        <span class="inventory-header-divider">|</span>
                        <span class="inventory-header-label"><i class="fas fa-warehouse"></i> Warehouse Inventory</span>
                    </div>
                    <span class="inventory-grand-total">${this.inventoryData.grandTotal.toLocaleString()} total units</span>
                </div>
                <div class="inventory-table-wrapper">
                    <table class="inventory-grid-table">
                        <thead>
                            <tr>
                                <th class="wh-header">Warehouse</th>
                                ${sizeHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${warehouseRows}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td class="wh-name">TOTAL</td>
                                ${totalCells}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
}