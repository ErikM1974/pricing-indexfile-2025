/**
 * Inventory Summary Component
 * Shows a compact inventory status with "Check Inventory" button
 * Replaces the full inventory table on product page
 */

export class InventorySummary {
    constructor(container) {
        this.container = container;
        this.data = null;
        this.styleNumber = null;
        this.colorCode = null;
    }

    update(inventoryData, styleNumber, colorCode) {
        this.data = inventoryData;
        this.styleNumber = styleNumber;
        this.colorCode = colorCode;
        this.render();
    }

    render() {
        if (!this.data) {
            this.showLoading();
            return;
        }

        const stockStatus = this.calculateStockStatus();
        
        this.container.innerHTML = `
            <div class="inventory-summary">
                <div class="stock-status">
                    <span class="stock-indicator ${stockStatus.className}">
                        ${stockStatus.icon} ${stockStatus.text}
                    </span>
                    ${stockStatus.details ? `<span class="stock-details">${stockStatus.details}</span>` : ''}
                </div>
                <button class="check-inventory-btn" onclick="window.checkInventoryDetails('${this.styleNumber}', '${this.colorCode}')">
                    Check Inventory
                </button>
            </div>
        `;
    }

    calculateStockStatus() {
        if (!this.data || !this.data.grandTotal) {
            return {
                className: 'out-of-stock',
                icon: '❌',
                text: 'Out of Stock',
                details: null
            };
        }

        const total = this.data.grandTotal;
        const sizesInStock = this.data.sizeTotals ? 
            this.data.sizeTotals.filter(qty => qty > 0).length : 0;
        const totalSizes = this.data.sizeTotals ? this.data.sizeTotals.length : 0;

        if (total === 0) {
            return {
                className: 'out-of-stock',
                icon: '❌',
                text: 'Out of Stock',
                details: null
            };
        } else if (total < 50) {
            return {
                className: 'low-stock',
                icon: '⚠️',
                text: 'Limited Stock',
                details: `${sizesInStock} of ${totalSizes} sizes available`
            };
        } else if (total < 200) {
            return {
                className: 'medium-stock',
                icon: '✓',
                text: 'In Stock',
                details: `${sizesInStock} of ${totalSizes} sizes available`
            };
        } else {
            return {
                className: 'high-stock',
                icon: '✅',
                text: 'In Stock',
                details: 'Most sizes available'
            };
        }
    }

    showLoading() {
        this.container.innerHTML = `
            <div class="inventory-summary loading">
                <span class="mini-spinner"></span>
                <span>Checking inventory...</span>
            </div>
        `;
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="inventory-summary error">
                <span class="stock-indicator out-of-stock">
                    ⚠️ Unable to check inventory
                </span>
            </div>
        `;
    }
}

// Global function for button click
window.checkInventoryDetails = function(styleNumber, colorCode) {
    // Open in same tab (can change to new tab if preferred)
    window.location.href = `/inventory-details.html?style=${styleNumber}&color=${encodeURIComponent(colorCode)}`;
};