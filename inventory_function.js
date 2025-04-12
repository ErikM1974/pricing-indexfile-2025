// --- Inventory Update Function ---
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
        // Construct the API URL with the correct endpoint
        const inventoryUrl = `${API_PROXY_BASE_URL}/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}${catalogColor ? '&color=' + encodeURIComponent(catalogColor) : ''}`;
        console.log("Inventory: Fetching from API URL:", inventoryUrl);
        
        // Fetch inventory data from the API
        const response = await fetch(inventoryUrl);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Inventory: Data received:", data);
        
        if (!data || data.length === 0) {
            inventoryArea.innerHTML = '<div class="info-message" style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #17a2b8; margin: 15px 0;"><p>No inventory data available for this style/color combination.</p></div>';
            return;
        }
        
        // Define standard size order
        const standardSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        
        // Group data by warehouse and size
        const warehouseData = {};
        const sizesFound = new Set();
        
        // Process the data to organize by warehouse and size
        data.forEach(item => {
            const warehouse = item.WarehouseName || 'Unknown';
            const size = item.size || 'N/A';
            const quantity = item.quantity || 0;
            
            // Add size to the set of found sizes
            sizesFound.add(size);
            
            // Initialize warehouse if not exists
            if (!warehouseData[warehouse]) {
                warehouseData[warehouse] = {};
            }
            
            // Add quantity for this size
            warehouseData[warehouse][size] = quantity;
        });
        
        // Convert sizesFound set to array and sort by standard size order
        const sizes = Array.from(sizesFound).sort((a, b) => {
            const indexA = standardSizes.indexOf(a);
            const indexB = standardSizes.indexOf(b);
            
            // If both sizes are in the standard list, sort by that order
            if (indexA >= 0 && indexB >= 0) {
                return indexA - indexB;
            }
            
            // If only one size is in the standard list, prioritize it
            if (indexA >= 0) return -1;
            if (indexB >= 0) return 1;
            
            // Otherwise, sort alphabetically
            return a.localeCompare(b);
        });
        
        // Calculate totals for each size
        const totals = {};
        sizes.forEach(size => {
            totals[size] = 0;
            Object.keys(warehouseData).forEach(warehouse => {
                totals[size] += warehouseData[warehouse][size] || 0;
            });
        });
        
        // Build the HTML for the inventory table
        let tableHtml = `
            <h4>Inventory for ${styleNumber}${catalogColor ? ' - ' + catalogColor : ''}</h4>
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
        Object.keys(warehouseData).sort().forEach(warehouse => {
            tableHtml += `
                        <tr>
                            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold;">${warehouse}</td>`;
            
            // Add cells for each size
            sizes.forEach(size => {
                const quantity = warehouseData[warehouse][size] || 0;
                const cellColor = quantity > 0 ? (quantity < 100 ? '#FFF3CD' : '#D1E7DD') : '#F8D7DA';
                
                tableHtml += `
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: ${cellColor};">${quantity}</td>`;
            });
            
            tableHtml += `
                        </tr>`;
        });
        
        // Add total row
        tableHtml += `
                        <tr style="background-color: #e9ecef; font-weight: bold;">
                            <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">TOTAL INVENTORY</td>`;
        
        // Add total cells for each size
        sizes.forEach(size => {
            tableHtml += `
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${totals[size]}</td>`;
        });
        
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