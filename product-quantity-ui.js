// product-quantity-ui.js - Creates the quantity input UI (Matrix or Grid)

console.log("[QUANTITY-UI:LOAD] Product quantity UI creation module loaded.");

(function() {
    "use strict";

    // Function to create the quantity input fields (matrix layout)
    function createQuantityMatrix(sizes) {
        console.log("[QUANTITY-UI] Creating quantity matrix with sizes:", sizes);
        const matrixContainer = document.getElementById('quantity-matrix'); // Target the specific container
        if (!matrixContainer) {
            console.error("[QUANTITY-UI] Quantity matrix container (#quantity-matrix) not found.");
            return false; // Indicate failure
        }

        matrixContainer.innerHTML = ''; // Clear existing content first
        matrixContainer.style.display = 'block'; // Ensure container is visible

        if (!sizes || sizes.length === 0) {
            console.warn('[QUANTITY-UI] No sizes provided to createQuantityMatrix.');
            matrixContainer.innerHTML = '<p>No sizes available.</p>';
            return false; // Indicate failure
        }

        // Create table structure
        const table = document.createElement('table');
        table.className = 'quantity-input-table'; // Add class for styling
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.setAttribute('aria-label', 'Product Quantity Input Matrix'); // Accessibility

        const thead = table.createTHead();
        const tbody = table.createTBody();
        const headerRow = thead.insertRow();
        const inputRow = tbody.insertRow(); // Row for inputs
        inputRow.id = 'quantity-input-row'; // Keep ID if needed elsewhere
        const priceRow = tbody.insertRow(); // Row for prices
        priceRow.id = 'price-display-row'; // Keep ID if needed elsewhere

        // Add header cell for the price row label
        const priceHeaderCell = priceRow.insertCell();
        priceHeaderCell.textContent = 'Price:';
        priceHeaderCell.style.fontWeight = 'bold';
        priceHeaderCell.style.textAlign = 'right';
        priceHeaderCell.style.paddingRight = '10px';
        priceHeaderCell.style.border = '1px solid #ddd'; // Style consistency
        priceHeaderCell.style.verticalAlign = 'top';

        // Add header cell for the input row label (optional, could be empty)
        const inputHeaderCell = inputRow.insertCell();
        inputHeaderCell.textContent = 'Qty:'; // Or leave empty: ''
        inputHeaderCell.style.fontWeight = 'bold';
        inputHeaderCell.style.textAlign = 'right';
        inputHeaderCell.style.paddingRight = '10px';
        inputHeaderCell.style.border = '1px solid #ddd'; // Style consistency

        // Add empty header cell for the main header row (aligns with Qty/Price labels)
        const mainHeaderSpacer = document.createElement('th');
        mainHeaderSpacer.setAttribute('scope', 'col'); // Accessibility
        mainHeaderSpacer.style.border = '1px solid #ddd'; // Style consistency
        headerRow.appendChild(mainHeaderSpacer);


        // Populate header, input, and price rows for each size
        sizes.forEach(size => {
            // Header cell
            const th = document.createElement('th');
            th.textContent = size;
            th.setAttribute('scope', 'col'); // Accessibility
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.textAlign = 'center';
            th.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(th);

            // Input cell
            const tdInput = inputRow.insertCell();
            tdInput.style.border = '1px solid #ddd';
            tdInput.style.padding = '5px';
            tdInput.style.textAlign = 'center';

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'quantity-input';
            input.dataset.size = size;
            input.min = '0';
            input.placeholder = '0';
            input.value = ''; // Start empty
            input.setAttribute('aria-label', `Quantity for size ${size}`);
            input.style.width = '50px'; // Adjust width as needed
            input.style.textAlign = 'center';
            tdInput.appendChild(input);

             // Price display cell
             const tdPrice = priceRow.insertCell();
             tdPrice.style.border = '1px solid #ddd';
             tdPrice.style.padding = '5px';
             tdPrice.style.textAlign = 'center';
             tdPrice.style.verticalAlign = 'top'; // Align price info top

             const priceDisplay = document.createElement('div');
             priceDisplay.className = 'price-display'; // Use this class for updates
             priceDisplay.dataset.size = size;
             priceDisplay.textContent = '$0.00'; // Initial placeholder
             priceDisplay.style.fontSize = '0.9em';
             priceDisplay.style.minHeight = '40px'; // Ensure space for price breakdown
             tdPrice.appendChild(priceDisplay);
        });

        matrixContainer.appendChild(table);
        console.log("[QUANTITY-UI] Quantity matrix created successfully.");
        return true; // Indicate success
    }

    // Function to create the quantity input fields (grid layout)
    function createSizeQuantityGrid(sizes) {
         console.log("[QUANTITY-UI] Creating size quantity grid with sizes:", sizes);
        const gridContainer = document.getElementById('size-quantity-grid-container'); // Target the specific container
        if (!gridContainer) {
            console.error("[QUANTITY-UI] Size quantity grid container (#size-quantity-grid-container) not found.");
            return false; // Indicate failure
        }

        gridContainer.innerHTML = ''; // Clear existing content first
        gridContainer.style.display = 'grid'; // Use grid layout
        // Responsive columns: Adjust minmax for desired minimum item width
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        gridContainer.style.gap = '15px'; // Space between items

        if (!sizes || sizes.length === 0) {
            console.warn('[QUANTITY-UI] No sizes provided to createSizeQuantityGrid.');
            gridContainer.innerHTML = '<p>No sizes available.</p>';
            return false; // Indicate failure
        }

        sizes.forEach(size => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'size-quantity-item'; // Class for styling individual items
            itemDiv.style.display = 'grid'; // Use grid for item layout
            itemDiv.style.gridTemplateColumns = 'auto 1fr auto'; // Label | Input Control | Price
            itemDiv.style.gap = '10px'; // Space within item
            itemDiv.style.alignItems = 'center';
            itemDiv.style.padding = '10px';
            itemDiv.style.border = '1px solid #eee';
            itemDiv.style.borderRadius = '4px';
            itemDiv.style.backgroundColor = '#f9f9f9';

            // Label
            const label = document.createElement('label');
            const safeSizeIdPart = size.replace(/\W/g, '-'); // Make ID safe for 'for' attribute
            label.textContent = size;
            label.htmlFor = `qty-${safeSizeIdPart}`;
            label.style.fontWeight = 'bold';
            label.style.gridColumn = '1 / 2'; // Place in first column

            // Quantity Control (Input with +/- buttons)
            const quantityControl = document.createElement('div');
            quantityControl.className = 'quantity-control';
            quantityControl.style.display = 'flex';
            quantityControl.style.alignItems = 'center';
            quantityControl.style.justifyContent = 'center'; // Center buttons/input
            quantityControl.style.gridColumn = '2 / 3'; // Place in second column

            const decreaseBtn = document.createElement('button');
            decreaseBtn.type = 'button';
            decreaseBtn.className = 'quantity-btn decrease-btn';
            decreaseBtn.textContent = '-';
            decreaseBtn.setAttribute('aria-label', `Decrease quantity for size ${size}`);
            // Styles applied externally or via CSS

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `qty-${safeSizeIdPart}`;
            input.className = 'quantity-input';
            input.dataset.size = size;
            input.min = '0';
            input.placeholder = '0';
            input.value = ''; // Start empty
            input.setAttribute('aria-label', `Quantity for size ${size}`);
            input.style.margin = '0 5px'; // Space around input
            // Styles applied externally or via CSS

            const increaseBtn = document.createElement('button');
            increaseBtn.type = 'button';
            increaseBtn.className = 'quantity-btn increase-btn';
            increaseBtn.textContent = '+';
            increaseBtn.setAttribute('aria-label', `Increase quantity for size ${size}`);
            // Styles applied externally or via CSS

            quantityControl.appendChild(decreaseBtn);
            quantityControl.appendChild(input);
            quantityControl.appendChild(increaseBtn);

            // Price Display
            const priceDisplay = document.createElement('div');
            priceDisplay.className = 'size-price'; // Use this class for updates
            priceDisplay.dataset.size = size;
            priceDisplay.textContent = '$0.00'; // Initial placeholder
            priceDisplay.style.fontWeight = 'bold';
            priceDisplay.style.textAlign = 'right';
            priceDisplay.style.gridColumn = '3 / 4'; // Place in third column
            priceDisplay.style.minWidth = '60px'; // Ensure some space for price

            // Append elements to itemDiv
            itemDiv.appendChild(label);
            itemDiv.appendChild(quantityControl);
            itemDiv.appendChild(priceDisplay);

            gridContainer.appendChild(itemDiv);
        });

        console.log("[QUANTITY-UI] Size quantity grid created successfully.");
        return true; // Indicate success
    }

    // Expose public API
    window.ProductQuantityUI = {
        createQuantityMatrix: createQuantityMatrix,
        createSizeQuantityGrid: createSizeQuantityGrid
    };

})();