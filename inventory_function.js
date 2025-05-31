// --- Inventory Update Function Using New Tabular API ---
async function loadInventory(styleNumber, catalogColor) {
    console.log(`Inventory: Loading data for Style: ${styleNumber}, Color Code: ${catalogColor || 'ALL'}`);
    
    // Get the inventory area element
    const inventoryArea = document.getElementById('inventory-area');
    if (!inventoryArea) {
        console.error("Inventory: Area #inventory-area not found!");
        return;
    }
    
    // Show loading message
    inventoryArea.innerHTML = '<div class="loading-message">Loading inventory data...</div>';
    
    try {
        // Construct the API URL with the new endpoint that returns tabular data
        const inventoryUrl = `${API_PROXY_BASE_URL}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}${catalogColor ? '&color=' + encodeURIComponent(catalogColor) : ''}`;
        console.log("Inventory: Fetching from new tabular API URL:", inventoryUrl);
        
        // Fetch inventory data from the API
        const response = await fetch(inventoryUrl);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Inventory: Tabular data received:", data);
        
        if (!data || !data.sizes || data.sizes.length === 0 || !data.warehouses || data.warehouses.length === 0) {
            inventoryArea.innerHTML = '<div class="info-message" style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #17a2b8; margin: 15px 0;"><p>No inventory data available for this style/color combination.</p></div>';
            return;
        }
        
        // Extract data from the response
        const { style, color, sizes, warehouses, sizeTotals, grandTotal } = data;
        
        // Build the HTML for the inventory table
        let tableHtml = `
            <h4>Inventory Levels (${color})</h4>
            <div class="inventory-table-container" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #ddd;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Warehouse</th>`;
        
        // Add column headers for each size
        sizes.forEach(size => {
            tableHtml += `
                            <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">${size}</th>`;
        });
        
        tableHtml += `
                        </tr>
                    </thead>
                    <tbody>`;
        
        // Add rows for each warehouse
        warehouses.forEach(warehouse => {
            tableHtml += `
                        <tr>
                            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold;">${warehouse.name}</td>`;
            
            // Add cells for each size's inventory quantity
            warehouse.inventory.forEach((quantity, index) => {
                // Color coding based on quantity
                let cellColor;
                if (quantity <= 0) {
                    cellColor = '#F8D7DA'; // Red for no stock
                } else if (quantity < 24) {
                    cellColor = '#FFF3CD'; // Yellow for low stock
                    // Use orange for very low stock (less than 10)
                    if (quantity < 10) {
                        cellColor = '#FFE0B2';
                    }
                } else {
                    cellColor = '#D1E7DD'; // Green for good stock
                }
                
                // Text color based on quantity
                let textColor;
                if (quantity <= 0) {
                    textColor = '#721C24'; // Dark red for no stock
                } else if (quantity < 24) {
                    textColor = '#856404'; // Dark yellow/orange for low stock
                    // Use darker orange for very low stock
                    if (quantity < 10) {
                        textColor = '#E65100';
                    }
                } else {
                    textColor = '#155724'; // Dark green for good stock
                }
                
                tableHtml += `
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: ${cellColor}; color: ${textColor}; font-weight: ${quantity < 24 ? 'bold' : 'normal'};">${quantity}</td>`;
            });
            
            // Add warehouse total
            tableHtml += `
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #e9ecef; font-weight: bold;">${warehouse.total}</td>`;
            
            tableHtml += `
                        </tr>`;
        });
        
        // Add total row
        tableHtml += `
                        <tr style="background-color: #e9ecef; font-weight: bold;">
                            <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">TOTAL INVENTORY</td>`;
        
        // Add total cells for each size
        sizeTotals.forEach(total => {
            tableHtml += `
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${total}</td>`;
        });
        
        // Add grand total
        tableHtml += `
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${grandTotal}</td>`;
        
        tableHtml += `
                        </tr>
                    </tbody>
                </table>
            </div>
            <p style="font-size: 0.8em; color: #666; margin-top: 10px;">Last updated: ${new Date().toLocaleString()}</p>
        `;
        
        // Update the inventory area with the table
        inventoryArea.innerHTML = tableHtml;
        
    } catch (error) {
        console.error("Inventory: Failed to load data:", error);
        inventoryArea.innerHTML = `
            <div class="error-message" style="padding: 15px; background-color: #f8d7da; border-left: 4px solid #dc3545; margin: 15px 0;">
                <h5 style="color: #721c24; margin-top: 0;">Error Loading Inventory</h5>
                <p>${error.message || 'Unknown error'}</p>
            </div>
        `;
    }
}