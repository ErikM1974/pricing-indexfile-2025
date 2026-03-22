/**
 * Quote Extended Sizes - Shared Module
 * Extracted 2026-03-21 from embroidery/DTG/screenprint quote builders
 *
 * Provides extended size popup functionality (3XL, 4XL, 5XL, XS, pants/shorts, OSFA)
 * shared across Embroidery, DTG, and Screenprint quote builders.
 *
 * DTF uses a different class-based architecture and is NOT included.
 *
 * Dependencies (must be defined globally by each builder):
 *   - window.childRowMap — tracks child rows: { parentRowId: { size: childRowId } }
 *   - window.createChildRow(parentRowId, size, qty) — creates builder-specific child row HTML
 *   - window.removeChildRow(parentRowId, size) — removes a child row
 *   - window.recalculatePricing() — builder-specific pricing recalculation
 *   - window.getAvailableExtendedSizes(styleNumber, color) — fetches available sizes from API
 *   - window.showToast(message, type) — shows toast notification
 *   - window.escapeHtml(str) — XSS protection (from quote-builder-utils.js)
 */
/**
 * NOTE: No IIFE wrapper — these functions reference globals (childRowMap, createChildRow,
 * recalculatePricing, etc.) declared with let/function in each builder's inline script.
 * `let` declarations don't go on `window`, so we need direct scope access.
 */

    /**
     * Open the extended size picker popup for a product row
     * Dynamically fetches available sizes from API
     * @param {string} rowId - The parent row ID (numeric, e.g., '1')
     */
    window.openExtendedSizePopup = async function(rowId) {
        const popup = document.getElementById('extended-size-popup');
        const backdrop = document.getElementById('size-popup-backdrop');
        const grid = document.getElementById('size-popup-grid');
        const applyBtn = popup.querySelector('.size-popup-apply');

        // Store which row we're editing (as numeric ID)
        popup.dataset.rowId = rowId;

        // Get parent row to find style and color info (DOM ID has 'row-' prefix)
        const parentRow = document.getElementById(`row-${rowId}`);
        if (!parentRow) {
            console.error('Cannot find row:', `row-${rowId}`);
            return;
        }

        const styleNumber = parentRow.dataset.style;
        const catalogColor = parentRow.dataset.catalogColor || parentRow.dataset.color;

        if (!styleNumber) {
            showToast('Select a product first', 'error');
            return;
        }

        // Show popup with loading state
        popup.classList.remove('hidden');
        backdrop.classList.remove('hidden');
        applyBtn.disabled = true;

        // Check if this is a pants or shorts product (use stored sizes directly)
        const isPants = parentRow.dataset.sizeCategory === 'pants';
        const isShorts = parentRow.dataset.sizeCategory === 'shorts';
        let availableSizes;

        if (isPants && parentRow.dataset.pantsSizes) {
            // For pants, use the sizes stored from analyzeSizeCategory
            availableSizes = JSON.parse(parentRow.dataset.pantsSizes);
            // Update popup header for pants
            popup.querySelector('.size-popup-header h4').innerHTML = '<i class="fas fa-ruler"></i> Waist/Inseam Sizes';
            popup.querySelector('.size-popup-hint').textContent = 'Enter quantities for each waist/inseam combination. These create separate line items.';
        } else if (isShorts && parentRow.dataset.shortsSizes) {
            // For shorts (waist-only), use the sizes stored from analyzeSizeCategory
            availableSizes = JSON.parse(parentRow.dataset.shortsSizes);
            // Update popup header for shorts
            popup.querySelector('.size-popup-header h4').innerHTML = '<i class="fas fa-ruler"></i> Waist Sizes';
            popup.querySelector('.size-popup-hint').textContent = 'Enter quantities for each waist size. These create separate line items.';
        } else {
            // Show loading spinner for non-pants
            grid.innerHTML = `
                <div class="size-popup-loading" style="grid-column: 1 / -1;">
                    <div class="spinner"></div>
                    <span>Loading available sizes...</span>
                </div>
            `;
            // Fetch available sizes from API
            availableSizes = await getAvailableExtendedSizes(styleNumber, catalogColor);
            // Reset header for non-pants
            popup.querySelector('.size-popup-header h4').innerHTML = '<i class="fas fa-ruler"></i> Extended Sizes (Size06)';
            popup.querySelector('.size-popup-hint').textContent = 'Enter quantities for extended sizes. These create separate line items.';
        }

        // Check if we have any sizes
        if (!availableSizes || availableSizes.length === 0) {
            const sizeType = isPants ? 'waist/inseam' : (isShorts ? 'waist' : 'extended');
            grid.innerHTML = `
                <div class="size-popup-empty" style="grid-column: 1 / -1;">
                    <i class="fas fa-info-circle"></i><br>
                    No ${sizeType} sizes available for ${escapeHtml(styleNumber)}.
                </div>
            `;
            applyBtn.disabled = true;
            return;
        }

        // Generate size inputs with current values
        if (isShorts) {
            // Shorts: simple waist-only list (W30, W32, etc.)
            grid.innerHTML = availableSizes.map(size => {
                const currentQty = getExtendedSizeQty(rowId, size);
                // Display as "Waist 30" instead of "W30"
                const waistNum = size.replace('W', '');
                return `
                    <div class="size-popup-item">
                        <label>Waist ${escapeHtml(waistNum)}</label>
                        <input type="number"
                               min="0"
                               data-size="${escapeHtml(size)}"
                               value="${currentQty || ''}"
                               placeholder="0"
                               class="size-popup-input">
                    </div>
                `;
            }).join('');
        } else if (isPants) {
            // Group pants sizes by waist for better UX
            const waistGroups = {};
            availableSizes.forEach(size => {
                if (/^\d{4}$/.test(size)) {
                    const waist = size.substring(0, 2);
                    if (!waistGroups[waist]) waistGroups[waist] = [];
                    waistGroups[waist].push(size);
                }
            });

            // Common waists that should be expanded by default
            const commonWaists = ['30', '32', '34', '36'];

            grid.innerHTML = Object.keys(waistGroups).sort((a, b) => parseInt(a) - parseInt(b)).map(waist => {
                const isExpanded = commonWaists.includes(waist);
                const sizesHtml = waistGroups[waist].map(size => {
                    const currentQty = getExtendedSizeQty(rowId, size);
                    const inseam = size.substring(2, 4);
                    return `
                        <div class="size-popup-item">
                            <label>${escapeHtml(waist)}x${escapeHtml(inseam)}</label>
                            <input type="number"
                                   min="0"
                                   data-size="${escapeHtml(size)}"
                                   value="${currentQty || ''}"
                                   placeholder="0"
                                   class="size-popup-input">
                        </div>
                    `;
                }).join('');

                return `
                    <div class="pants-waist-group ${isExpanded ? 'expanded' : 'collapsed'}">
                        <div class="waist-header" onclick="toggleWaistGroup(this)">
                            <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i>
                            <span>Waist ${escapeHtml(waist)}</span>
                            <span class="waist-count">(${waistGroups[waist].length} sizes)</span>
                        </div>
                        <div class="waist-sizes" style="${isExpanded ? '' : 'display: none;'}">
                            ${sizesHtml}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            // Non-pants: flat list (existing behavior)
            grid.innerHTML = availableSizes.map(size => {
                const currentQty = getExtendedSizeQty(rowId, size);
                return `
                    <div class="size-popup-item">
                        <label>${escapeHtml(size)}</label>
                        <input type="number"
                               min="0"
                               data-size="${escapeHtml(size)}"
                               value="${currentQty || ''}"
                               placeholder="0"
                               class="size-popup-input">
                    </div>
                `;
            }).join('');
        }

        // Enable apply button
        applyBtn.disabled = false;

        // Focus first input
        const firstInput = grid.querySelector('input');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }

        // Store available sizes for OSFA-only detection in applyExtendedSizes()
        popup.dataset.availableSizes = JSON.stringify(availableSizes);
    };

    /**
     * Close the extended size picker popup
     */
    window.closeExtendedSizePopup = function() {
        const popup = document.getElementById('extended-size-popup');
        const backdrop = document.getElementById('size-popup-backdrop');

        popup.classList.add('hidden');
        backdrop.classList.add('hidden');
        popup.dataset.rowId = '';
    };

    /**
     * Toggle a waist group in the pants size picker
     * @param {HTMLElement} headerElement - The clicked waist-header element
     */
    window.toggleWaistGroup = function(headerElement) {
        const group = headerElement.closest('.pants-waist-group');
        const sizesDiv = group.querySelector('.waist-sizes');
        const icon = headerElement.querySelector('i');

        if (group.classList.contains('expanded')) {
            group.classList.remove('expanded');
            group.classList.add('collapsed');
            sizesDiv.style.display = 'none';
            icon.className = 'fas fa-chevron-right';
        } else {
            group.classList.remove('collapsed');
            group.classList.add('expanded');
            sizesDiv.style.display = '';
            icon.className = 'fas fa-chevron-down';
        }
    };

    /**
     * Get current quantity for an extended size from child rows
     * @param {string} parentRowId - Parent row ID
     * @param {string} size - Size name (e.g., '4XL')
     * @returns {number} Current quantity or 0
     */
    window.getExtendedSizeQty = function(parentRowId, size) {
        // Check if there's a child row for this size
        if (childRowMap[parentRowId] && childRowMap[parentRowId][size]) {
            const childRowId = childRowMap[parentRowId][size];
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                const qtyCell = childRow.querySelector('.qty-display');
                if (qtyCell) {
                    return parseInt(qtyCell.textContent) || 0;
                }
            }
        }

        // Also check the parent row's 3XL input for existing value (old behavior)
        if (size === '3XL') {
            const parentRow = document.getElementById(`row-${parentRowId}`);
            if (parentRow) {
                const xxxlInput = parentRow.querySelector('input[data-size="3XL"]');
                if (xxxlInput && !xxxlInput.classList.contains('xxxl-picker-btn')) {
                    return parseInt(xxxlInput.value) || 0;
                }
            }
        }

        return 0;
    };

    /**
     * Apply extended size changes from the popup
     */
    window.applyExtendedSizes = function() {
        const popup = document.getElementById('extended-size-popup');
        const rowId = popup.dataset.rowId;

        if (!rowId) {
            console.error('No row ID stored in popup');
            closeExtendedSizePopup();
            return;
        }

        // rowId is numeric, DOM elements have 'row-' prefix
        const parentRow = document.getElementById(`row-${rowId}`);
        if (!parentRow) {
            console.error('Parent row not found:', `row-${rowId}`);
            closeExtendedSizePopup();
            return;
        }

        // Check if this is an OSFA-only product (beanies, caps, bags)
        // OSFA is the BASE size for these products, not an upcharge
        const availableSizes = JSON.parse(popup.dataset.availableSizes || '[]');
        const isOSFAOnly = availableSizes.length === 1 && availableSizes[0] === 'OSFA';

        // Get all size inputs from popup
        const sizeInputs = popup.querySelectorAll('.size-popup-input');
        let totalExtendedQty = 0;
        let sizesChanged = [];

        sizeInputs.forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            const currentQty = getExtendedSizeQty(rowId, size);

            if (qty !== currentQty) {
                sizesChanged.push({ size, qty, previousQty: currentQty });
            }

            if (qty > 0) {
                totalExtendedQty += qty;

                // OSFA-only product: put qty in parent row, don't create child row
                // OSFA is the BASE size for these products (beanies, caps, bags)
                if (isOSFAOnly && size === 'OSFA') {
                    parentRow.dataset.osfaQty = qty;
                    parentRow.dataset.isOsfaOnly = 'true';
                    document.getElementById(`row-qty-${rowId}`).textContent = qty;
                } else {
                    // Normal extended size - create child row with upcharge
                    createOrUpdateExtendedChildRow(rowId, size, qty);
                }
            } else if (currentQty > 0) {
                // Remove quantity - handle differently for OSFA-only
                if (isOSFAOnly && size === 'OSFA') {
                    parentRow.dataset.osfaQty = '0';
                    document.getElementById(`row-qty-${rowId}`).textContent = '0';
                } else {
                    removeChildRow(rowId, size);
                }
            }
        });

        // Update the XXXL cell display
        if (isOSFAOnly) {
            // For OSFA-only, show the qty in the XXXL cell (not "+")
            const xxxlCell = parentRow.querySelector('.xxxl-picker-btn');
            if (xxxlCell) {
                xxxlCell.value = totalExtendedQty > 0 ? totalExtendedQty.toString() : '';
            }
        } else {
            updateXXXLCellDisplay(rowId, totalExtendedQty);
        }

        // Recalculate pricing
        recalculatePricing();

        // Close popup
        closeExtendedSizePopup();
    };

    /**
     * Create or update a child row for an extended size
     * @param {string} parentRowId - Parent row ID
     * @param {string} size - Size name (e.g., '4XL')
     * @param {number} qty - Quantity
     */
    window.createOrUpdateExtendedChildRow = function(parentRowId, size, qty) {
        // Initialize map entry if needed
        if (!childRowMap[parentRowId]) {
            childRowMap[parentRowId] = {};
        }

        // Check if child row already exists
        if (childRowMap[parentRowId][size]) {
            const existingChildId = childRowMap[parentRowId][size];
            const existingRow = document.getElementById(`row-${existingChildId}`);
            if (existingRow) {
                // Update existing row's quantity
                const qtyDisplay = existingRow.querySelector('.qty-display');
                if (qtyDisplay) qtyDisplay.textContent = qty;

                // Update the size input value
                const sizeInput = existingRow.querySelector(`input[data-size="${size}"]`);
                if (sizeInput) sizeInput.value = qty;

                // Recalculate unit price display
                updateChildRowPrice(existingChildId);
                return;
            }
        }

        // Need to create new child row - use existing createChildRow function
        createChildRow(parentRowId, size, qty);
    };

    /**
     * Update the XXXL cell display to show total extended sizes
     * @param {string|number} rowId - Row ID (numeric)
     * @param {number} total - Total quantity of all Size06 items
     */
    window.updateXXXLCellDisplay = function(rowId, total) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return;

        const xxxlInput = row.querySelector('input[data-size="3XL"]');
        if (!xxxlInput) return;

        // Make it a picker button if not already
        if (!xxxlInput.classList.contains('xxxl-picker-btn')) {
            xxxlInput.classList.add('xxxl-picker-btn');
            xxxlInput.readOnly = true;
        }

        // Always clear value - child rows display individual quantities
        // Show checkmark (✓) if sizes exist, + if none - avoids confusing "4" display
        xxxlInput.value = '';
        xxxlInput.placeholder = total > 0 ? '✓' : '+';
    };

    /**
     * Update child row price after qty change
     * Price logic is handled by recalculatePricing() — this is a stub
     * @param {string|number} childRowId - Child row ID (numeric)
     */
    window.updateChildRowPrice = function(childRowId) {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (!childRow) return;

        const priceCell = childRow.querySelector('.unit-price-display');
        const qtyDisplay = childRow.querySelector('.qty-display');
        if (!priceCell || !qtyDisplay) return;

        // Get qty and recalculate (price logic is handled by recalculatePricing)
    };
