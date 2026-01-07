/**
 * Color Picker Component - Shared Module for Quote Builders
 *
 * Used by: DTG, Screen Print, DTF, and Embroidery Quote Builders
 *
 * This module provides a unified color picker implementation that can be
 * configured per-builder while maintaining consistent behavior.
 *
 * Features:
 * - Dropdown toggle with keyboard support
 * - Arrow key navigation (configurable)
 * - Color selection with swatch display
 * - Child row color cascade
 * - Duplicate detection (configurable)
 * - Scroll-into-view behavior (configurable)
 *
 * Usage:
 *   // Initialize with builder-specific config
 *   const colorPicker = new ColorPickerComponent({
 *       onColorSelect: (rowId, colorData) => { recalculatePricing(); },
 *       onDuplicateDetected: (rowId, existingRowId) => { showToast('Duplicate!'); },
 *       enableDuplicateCheck: true,
 *       enableArrowNavigation: true,
 *       enableScrollIntoView: true
 *   });
 *
 * @version 1.0.0
 * @created 2026-01-07
 */

class ColorPickerComponent {
    constructor(config = {}) {
        this.config = {
            // Feature flags
            enableDuplicateCheck: config.enableDuplicateCheck ?? true,
            enableArrowNavigation: config.enableArrowNavigation ?? true,
            enableScrollIntoView: config.enableScrollIntoView ?? true,
            enableProductTypeDetection: config.enableProductTypeDetection ?? false,

            // Callbacks
            onColorSelect: config.onColorSelect || null,           // (rowId, colorData) => {}
            onChildColorSelect: config.onChildColorSelect || null, // (childRowId, parentRowId, colorData) => {}
            onDuplicateDetected: config.onDuplicateDetected || null, // (rowId, existingRowId, style, color) => {}
            onColorCascade: config.onColorCascade || null,         // (parentRowId, childRowIds) => {}
            detectProductType: config.detectProductType || null,   // (rowId, colorData) => {}

            // Selectors (customizable)
            rowSelector: config.rowSelector || 'row-',
            dropdownSelector: config.dropdownSelector || 'color-dropdown-',

            // Child row tracking (reference to global childRowMap)
            getChildRowMap: config.getChildRowMap || (() => window.childRowMap || {}),

            // Duplicate check function
            findExistingRow: config.findExistingRow || null // (style, catalogColor, excludeRowId) => rowId|null
        };

        console.log('[ColorPickerComponent] Initialized with config:', {
            enableDuplicateCheck: this.config.enableDuplicateCheck,
            enableArrowNavigation: this.config.enableArrowNavigation,
            enableScrollIntoView: this.config.enableScrollIntoView
        });
    }

    /**
     * Toggle the color picker dropdown for a row
     * @param {number} rowId - The row ID
     */
    toggleColorPicker(rowId) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) {
            console.warn(`[ColorPicker] Row not found: row-${rowId}`);
            return;
        }

        const pickerSelected = row.querySelector('.color-picker-selected');
        const dropdown = row.querySelector('.color-picker-dropdown');

        if (!dropdown) {
            console.warn(`[ColorPicker] Dropdown not found for row-${rowId}`);
            return;
        }

        // Don't open if disabled
        if (pickerSelected && pickerSelected.classList.contains('disabled')) {
            return;
        }

        // Close all other dropdowns first
        document.querySelectorAll('.color-picker-dropdown').forEach(d => {
            if (d !== dropdown) {
                d.classList.add('hidden');
            }
        });

        // Toggle this dropdown
        const wasHidden = dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');

        // If opening and scroll-into-view is enabled, scroll selected option
        if (wasHidden && this.config.enableScrollIntoView) {
            const selectedOption = dropdown.querySelector('.color-picker-option.selected');
            if (selectedOption) {
                setTimeout(() => {
                    selectedOption.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }, 50);
            }
        }
    }

    /**
     * Handle keyboard events on the color picker
     * @param {KeyboardEvent} event - The keyboard event
     * @param {number} rowId - The row ID
     */
    handleColorPickerKeydown(event, rowId) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return;

        const dropdown = row.querySelector('.color-picker-dropdown');
        if (!dropdown) return;

        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.toggleColorPicker(rowId);
                break;

            case 'Escape':
                event.preventDefault();
                dropdown.classList.add('hidden');
                break;

            case 'Tab':
                // Close dropdown on tab
                dropdown.classList.add('hidden');
                break;

            case 'ArrowDown':
            case 'ArrowUp':
                if (this.config.enableArrowNavigation && !dropdown.classList.contains('hidden')) {
                    event.preventDefault();
                    this.navigateOptions(dropdown, event.key === 'ArrowDown' ? 1 : -1);
                }
                break;
        }
    }

    /**
     * Navigate through color options with arrow keys
     * @param {HTMLElement} dropdown - The dropdown element
     * @param {number} direction - 1 for down, -1 for up
     */
    navigateOptions(dropdown, direction) {
        const options = Array.from(dropdown.querySelectorAll('.color-picker-option'));
        if (options.length === 0) return;

        // Find currently focused option
        const focusedIndex = options.findIndex(opt => opt.classList.contains('focused'));

        // Calculate new index with wrap-around
        let newIndex;
        if (focusedIndex === -1) {
            // Nothing focused, start at beginning or end
            newIndex = direction === 1 ? 0 : options.length - 1;
        } else {
            newIndex = focusedIndex + direction;
            if (newIndex < 0) newIndex = options.length - 1;
            if (newIndex >= options.length) newIndex = 0;
        }

        // Remove focus from all options
        options.forEach(opt => opt.classList.remove('focused'));

        // Add focus to new option
        options[newIndex].classList.add('focused');

        // Scroll into view
        options[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /**
     * Select a color for a parent row
     * @param {number} rowId - The row ID
     * @param {HTMLElement} optionEl - The clicked color option element
     */
    selectColor(rowId, optionEl) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row || !optionEl) return;

        // Extract color data from option element
        const colorData = {
            colorName: optionEl.dataset.colorName || optionEl.dataset.color,
            catalogColor: optionEl.dataset.catalogColor,
            swatchUrl: optionEl.dataset.swatchUrl || optionEl.dataset.image,
            hex: optionEl.dataset.hex
        };

        // Check for duplicate (same style + color already exists)
        if (this.config.enableDuplicateCheck && this.config.findExistingRow) {
            const style = row.dataset.style;
            const existingRowId = this.config.findExistingRow(style, colorData.catalogColor, rowId);

            if (existingRowId) {
                // Notify about duplicate
                if (this.config.onDuplicateDetected) {
                    this.config.onDuplicateDetected(rowId, existingRowId, style, colorData.colorName);
                }

                // Close dropdown without changing color
                const dropdown = row.querySelector('.color-picker-dropdown');
                if (dropdown) dropdown.classList.add('hidden');
                return;
            }
        }

        // Update the selected display
        this.updateColorDisplay(row, colorData);

        // Mark this option as selected in the dropdown
        const dropdown = row.querySelector('.color-picker-dropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.color-picker-option').forEach(opt => {
                opt.classList.remove('selected', 'focused');
            });
            optionEl.classList.add('selected');
            dropdown.classList.add('hidden');
        }

        // Store color data on the row
        row.dataset.color = colorData.colorName;
        row.dataset.catalogColor = colorData.catalogColor;
        if (colorData.swatchUrl) row.dataset.swatchUrl = colorData.swatchUrl;
        if (colorData.hex) row.dataset.hex = colorData.hex;

        // Cascade color to child rows
        this.cascadeColorToChildRows(rowId, colorData);

        // Enable size inputs (they're disabled until color is selected)
        this.enableSizeInputs(row);

        // Call product type detection if enabled
        if (this.config.enableProductTypeDetection && this.config.detectProductType) {
            this.config.detectProductType(rowId, colorData);
        }

        // Call the onColorSelect callback
        if (this.config.onColorSelect) {
            this.config.onColorSelect(rowId, colorData);
        }
    }

    /**
     * Select a color for a child row (extended sizes)
     * @param {number} childRowId - The child row ID
     * @param {number} parentRowId - The parent row ID
     * @param {HTMLElement} optionEl - The clicked color option element
     */
    selectChildColor(childRowId, parentRowId, optionEl) {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (!childRow || !optionEl) return;

        // Extract color data
        const colorData = {
            colorName: optionEl.dataset.colorName || optionEl.dataset.color,
            catalogColor: optionEl.dataset.catalogColor,
            swatchUrl: optionEl.dataset.swatchUrl || optionEl.dataset.image,
            hex: optionEl.dataset.hex
        };

        // Update child row display
        this.updateColorDisplay(childRow, colorData);

        // Mark as manually set (prevents parent cascade overwrite)
        childRow.dataset.colorManuallySet = 'true';

        // Store color data on child row
        childRow.dataset.color = colorData.colorName;
        childRow.dataset.catalogColor = colorData.catalogColor;
        if (colorData.swatchUrl) childRow.dataset.swatchUrl = colorData.swatchUrl;
        if (colorData.hex) childRow.dataset.hex = colorData.hex;

        // Close dropdown
        const dropdown = childRow.querySelector('.color-picker-dropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.color-picker-option').forEach(opt => {
                opt.classList.remove('selected', 'focused');
            });
            optionEl.classList.add('selected');
            dropdown.classList.add('hidden');
        }

        // Update visual indicators
        this.updateChildRowColorIndicators(parentRowId);

        // Call callback
        if (this.config.onChildColorSelect) {
            this.config.onChildColorSelect(childRowId, parentRowId, colorData);
        }
    }

    /**
     * Update the color display (swatch + text) for a row
     * @param {HTMLElement} row - The row element
     * @param {Object} colorData - Color data object
     */
    updateColorDisplay(row, colorData) {
        const swatch = row.querySelector('.color-picker-selected .color-swatch');
        const nameSpan = row.querySelector('.color-picker-selected .color-name');

        if (swatch) {
            swatch.classList.remove('empty');

            // Prefer swatch URL, fall back to hex color
            if (colorData.swatchUrl) {
                swatch.style.backgroundImage = `url('${colorData.swatchUrl}')`;
                swatch.style.backgroundSize = 'cover';
                swatch.style.backgroundPosition = 'center';
                swatch.style.backgroundColor = '';
            } else if (colorData.hex) {
                swatch.style.backgroundImage = '';
                swatch.style.backgroundColor = colorData.hex;
            }
        }

        if (nameSpan) {
            nameSpan.textContent = colorData.colorName;
            nameSpan.classList.remove('placeholder');
        }
    }

    /**
     * Cascade parent color to all child rows (unless manually overridden)
     * @param {number} parentRowId - The parent row ID
     * @param {Object} colorData - Color data to cascade
     */
    cascadeColorToChildRows(parentRowId, colorData) {
        const childRowMap = this.config.getChildRowMap();
        const childIds = childRowMap[parentRowId];

        if (!childIds || Object.keys(childIds).length === 0) return;

        const updatedChildIds = [];

        Object.values(childIds).forEach(childRowId => {
            const childRow = document.getElementById(`row-${childRowId}`);
            if (!childRow) return;

            // Skip if user manually set this child's color
            if (childRow.dataset.colorManuallySet === 'true') {
                return;
            }

            // Update child row data
            childRow.dataset.color = colorData.colorName;
            childRow.dataset.catalogColor = colorData.catalogColor;
            if (colorData.swatchUrl) childRow.dataset.swatchUrl = colorData.swatchUrl;
            if (colorData.hex) childRow.dataset.hex = colorData.hex;

            // Update child row display
            this.updateColorDisplay(childRow, colorData);

            // Update selected state in child's dropdown
            const dropdown = childRow.querySelector('.color-picker-dropdown');
            if (dropdown) {
                dropdown.querySelectorAll('.color-picker-option').forEach(opt => {
                    const optCatalog = opt.dataset.catalogColor;
                    opt.classList.toggle('selected', optCatalog === colorData.catalogColor);
                });
            }

            updatedChildIds.push(childRowId);
        });

        // Update visual indicators
        this.updateChildRowColorIndicators(parentRowId);

        // Call cascade callback
        if (this.config.onColorCascade && updatedChildIds.length > 0) {
            this.config.onColorCascade(parentRowId, updatedChildIds);
        }
    }

    /**
     * Update visual indicators showing which child rows have different colors
     * @param {number} parentRowId - The parent row ID
     */
    updateChildRowColorIndicators(parentRowId) {
        const parentRow = document.getElementById(`row-${parentRowId}`);
        if (!parentRow) return;

        const parentCatalogColor = parentRow.dataset.catalogColor;
        const childRowMap = this.config.getChildRowMap();
        const childIds = childRowMap[parentRowId];

        if (!childIds) return;

        Object.values(childIds).forEach(childRowId => {
            const childRow = document.getElementById(`row-${childRowId}`);
            if (!childRow) return;

            const childCatalogColor = childRow.dataset.catalogColor;
            const isDifferent = childCatalogColor && childCatalogColor !== parentCatalogColor;

            // Add/remove visual indicator class
            childRow.classList.toggle('color-differs-from-parent', isDifferent);

            // Update any indicator badge
            const indicator = childRow.querySelector('.color-diff-indicator');
            if (indicator) {
                indicator.style.display = isDifferent ? 'inline-block' : 'none';
            }
        });
    }

    /**
     * Enable size inputs after color is selected
     * @param {HTMLElement} row - The row element
     */
    enableSizeInputs(row) {
        // Enable regular size inputs
        row.querySelectorAll('.size-input').forEach(input => {
            if (!input.classList.contains('xxxl-picker-btn')) {
                input.disabled = false;
            }
        });

        // Enable the extended size picker button
        const extendedBtn = row.querySelector('.xxxl-picker-btn');
        if (extendedBtn) {
            extendedBtn.disabled = false;
        }

        // Focus the first enabled size input
        const firstInput = row.querySelector('.size-input:not(:disabled):not(.xxxl-picker-btn)');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    /**
     * Populate a color picker dropdown with options
     * @param {number} rowId - The row ID
     * @param {Array} colors - Array of color objects from API
     * @param {Object} options - Additional options
     */
    populateColorPicker(rowId, colors, options = {}) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return;

        const dropdown = row.querySelector('.color-picker-dropdown');
        if (!dropdown) return;

        // Clear existing options
        dropdown.innerHTML = '';

        // Store colors on row for child row creation
        row.dataset.colors = JSON.stringify(colors);

        // Build color options HTML
        colors.forEach(color => {
            const colorName = color.COLOR_NAME || color.colorName || color.name;
            const catalogColor = color.CATALOG_COLOR || color.catalogColor || colorName;
            const swatchUrl = color.COLOR_SQUARE_IMAGE || color.swatchUrl || color.image;
            const hex = color.HEX_CODE || color.hex;

            const optionEl = document.createElement('div');
            optionEl.className = 'color-picker-option';
            optionEl.dataset.colorName = colorName;
            optionEl.dataset.catalogColor = catalogColor;
            if (swatchUrl) optionEl.dataset.swatchUrl = swatchUrl;
            if (hex) optionEl.dataset.hex = hex;

            // Build swatch style
            let swatchStyle = '';
            if (swatchUrl) {
                swatchStyle = `background-image: url('${swatchUrl}'); background-size: cover; background-position: center;`;
            } else if (hex) {
                swatchStyle = `background-color: ${hex};`;
            }

            optionEl.innerHTML = `
                <span class="color-swatch" style="${swatchStyle}"></span>
                <span class="color-name">${colorName}</span>
            `;

            // Add click handler
            if (options.isChildRow) {
                optionEl.onclick = () => this.selectChildColor(rowId, options.parentRowId, optionEl);
            } else {
                optionEl.onclick = () => this.selectColor(rowId, optionEl);
            }

            dropdown.appendChild(optionEl);
        });

        // Enable the color picker (remove disabled state)
        const pickerSelected = row.querySelector('.color-picker-selected');
        if (pickerSelected) {
            pickerSelected.classList.remove('disabled');
        }
    }

    /**
     * Close all open color picker dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('.color-picker-dropdown').forEach(dropdown => {
            dropdown.classList.add('hidden');
        });
    }

    /**
     * Get the current color data for a row
     * @param {number} rowId - The row ID
     * @returns {Object|null} Color data or null
     */
    getColorData(rowId) {
        const row = document.getElementById(`row-${rowId}`);
        if (!row) return null;

        return {
            colorName: row.dataset.color,
            catalogColor: row.dataset.catalogColor,
            swatchUrl: row.dataset.swatchUrl,
            hex: row.dataset.hex
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorPickerComponent;
}

// Make available globally
window.ColorPickerComponent = ColorPickerComponent;

console.log('[ColorPickerComponent] Module loaded');
