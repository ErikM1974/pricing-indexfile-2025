/**
 * Inventory Display Component
 * Shows inventory levels in a clean, color-coded table
 */

export class InventoryDisplay {
    constructor(container) {
        this.container = container;
        this.data = null;
    }

    update(inventoryData) {
        if (!inventoryData || !inventoryData.sizes || inventoryData.sizes.length === 0) {
            this.showNoData();
            return;
        }

        this.data = inventoryData;
        this.render();
    }

    render() {
        const { style, color, sizes, warehouses, sizeTotals, grandTotal } = this.data;

        let html = `
            <div class="inventory-header">
                <span class="inventory-style">Style: ${style}</span>
                <span class="inventory-color">Color: ${color}</span>
                <button class="print-inventory" onclick="window.print()">🖨️ Print</button>
            </div>
            
            <div class="table-wrapper">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th class="warehouse-col">Warehouse</th>
                            ${sizes.map(size => `<th class="size-col">${size}</th>`).join('')}
                            <th class="total-col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${warehouses.map(warehouse => this.createWarehouseRow(warehouse, sizes)).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="totals-row">
                            <td class="warehouse-col">TOTAL</td>
                            ${sizeTotals.map(total => 
                                `<td class="size-col ${this.getStockClass(total)}">${total}</td>`
                            ).join('')}
                            <td class="total-col grand-total">${grandTotal}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="inventory-legend">
                <span class="legend-item">
                    <span class="stock-indicator good"></span> In Stock (24+)
                </span>
                <span class="legend-item">
                    <span class="stock-indicator low"></span> Low Stock (1-23)
                </span>
                <span class="legend-item">
                    <span class="stock-indicator out"></span> Out of Stock
                </span>
            </div>
        `;

        this.container.innerHTML = html;
    }

    createWarehouseRow(warehouse, sizes) {
        return `
            <tr>
                <td class="warehouse-col">${warehouse.name}</td>
                ${warehouse.inventory.map((qty, index) => 
                    `<td class="size-col ${this.getStockClass(qty)}">${qty}</td>`
                ).join('')}
                <td class="total-col">${warehouse.total}</td>
            </tr>
        `;
    }

    getStockClass(quantity) {
        if (quantity <= 0) return 'stock-out';
        if (quantity < 24) return 'stock-low';
        return 'stock-good';
    }

    showNoData() {
        this.container.innerHTML = `
            <div class="no-inventory">
                <p>No inventory data available</p>
            </div>
        `;
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="inventory-error">
                <p>${message}</p>
            </div>
        `;
    }
}