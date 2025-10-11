/**
 * Richardson Color Selector Enhancement - Visual Color Circle Design (2025)
 * Modern grid with color circles showing actual colors
 *
 * USAGE:
 * 1. Include richardson-112-images.js before this file
 * 2. Call RichardsonColorSelector.enhanceLineItem(lineItemElement) after creating a line item
 * 3. When style 112 is selected, visual color selector with circles appears
 */

class RichardsonColorSelector {
    /**
     * Color hex mapping for all Richardson 112 colors
     */
    static COLOR_HEX_MAP = {
        // Solid Colors
        'Black': '#000000',
        'Navy': '#001f3f',
        'Charcoal': '#4a4a4a',
        'White': '#ffffff',
        'Red': '#dc3545',
        'Kelly': '#2e7d32',
        'Light Blue': '#87ceeb',
        'Maroon': '#800000',
        'Smoke Blue': '#6c8e9e',
        'Columbia Blue': '#9bddff',
        'Dark Green': '#013220',
        'Loden': '#4a5f42',
        'Orange': '#ff6b35',
        'Royal': '#4169e1',
        'Amber Gold': '#f4a900',
        'Coffee': '#6f4e37',
        'Cream': '#fff5e1',
        'Light Grey': '#d3d3d3',
        'Quarry': '#7a7a7a',
        'Cardinal': '#8B001A',
        'Purple': '#800080',
        'Hot Pink': '#ff69b4',
        'Khaki': '#c3b091',
        'Biscuit': '#E6C9A8',
        'True Blue': '#0047AB',
        'Yellow': '#ffff00',
        'Heather Grey': '#b3b3b3',
        'Mink Beige': '#D4C4B0',
        'Blue Teal': '#008B8B',
        'Birch': '#F5F3EE',
        'Army Olive': '#4B5320',
        'Grey Brown': '#7C6A5C',
        'Dark Orange': '#FF8C00',

        // Split/Two-Tone Colors (use first color for now, will apply gradient)
        'Charcoal/Black': { primary: '#4a4a4a', secondary: '#000000' },
        'Navy/Khaki': { primary: '#001f3f', secondary: '#c3b091' },
        'Charcoal/Neon Green': { primary: '#4a4a4a', secondary: '#39ff14' },
        'Charcoal/Neon Orange': { primary: '#4a4a4a', secondary: '#ff6600' },
        'Charcoal/Neon Pink': { primary: '#4a4a4a', secondary: '#ff10f0' },
        'Black/Khaki': { primary: '#000000', secondary: '#c3b091' },
        'Black/White': { primary: '#000000', secondary: '#ffffff' },
        'Heather/Black': { primary: '#b3b3b3', secondary: '#000000' },
        'Heather/Navy': { primary: '#b3b3b3', secondary: '#001f3f' },
        'Navy/White': { primary: '#001f3f', secondary: '#ffffff' },
        'Royal/White': { primary: '#4169e1', secondary: '#ffffff' },
        'Smoke Blue/Navy': { primary: '#6c8e9e', secondary: '#001f3f' },
        'Charcoal/Red': { primary: '#4a4a4a', secondary: '#dc3545' },
        'Charcoal/Royal': { primary: '#4a4a4a', secondary: '#4169e1' },
        'Loden/Black': { primary: '#4a5f42', secondary: '#000000' },
        'Navy/Gold': { primary: '#001f3f', secondary: '#ffd700' },
        'Black/Red': { primary: '#000000', secondary: '#dc3545' },
        'Navy/Red': { primary: '#001f3f', secondary: '#dc3545' },
        'Pink/White': { primary: '#ffc0cb', secondary: '#ffffff' },
        'Red/White': { primary: '#dc3545', secondary: '#ffffff' },
        'Black/Neon Green': { primary: '#000000', secondary: '#39ff14' },
        'Black/Orange': { primary: '#000000', secondary: '#ff6b35' },
        'Navy/Neon Green': { primary: '#001f3f', secondary: '#39ff14' },

        // Additional Split Colors (2025-01-10)
        'Cardinal/White': { primary: '#8B001A', secondary: '#ffffff' },
        'Charcoal/White': { primary: '#4a4a4a', secondary: '#ffffff' },
        'Dark Green/White': { primary: '#013220', secondary: '#ffffff' },
        'Maroon/White': { primary: '#800000', secondary: '#ffffff' },
        'Navy/Orange': { primary: '#001f3f', secondary: '#ff6b35' },
        'Red/Black': { primary: '#dc3545', secondary: '#000000' },
        'Royal/Black': { primary: '#4169e1', secondary: '#000000' },
        'Purple/White': { primary: '#800080', secondary: '#ffffff' },
        'Orange/White': { primary: '#ff6b35', secondary: '#ffffff' },
        'Orange/Black': { primary: '#ff6b35', secondary: '#000000' },
        'Khaki/White': { primary: '#c3b091', secondary: '#ffffff' },
        'Kelly/White': { primary: '#2e7d32', secondary: '#ffffff' },
        'Khaki/Coffee': { primary: '#c3b091', secondary: '#6f4e37' },
        'Hot Pink/White': { primary: '#ff69b4', secondary: '#ffffff' },
        'Heather Grey/Dark Green': { primary: '#b3b3b3', secondary: '#013220' },
        'Heather Grey/Royal': { primary: '#b3b3b3', secondary: '#4169e1' },
        'Heather Grey/White': { primary: '#b3b3b3', secondary: '#ffffff' },
        'Hot Pink/Black': { primary: '#ff69b4', secondary: '#000000' },
        'Cardinal/Black': { primary: '#8B001A', secondary: '#000000' },
        'Navy/Charcoal': { primary: '#001f3f', secondary: '#4a4a4a' },
        'Biscuit/True Blue': { primary: '#E6C9A8', secondary: '#0047AB' },
        'Black/Yellow': { primary: '#000000', secondary: '#ffff00' },
        'Heather Grey/Light Grey': { primary: '#b3b3b3', secondary: '#d3d3d3' },

        // Tri-Color (Three-Tone) Colors
        'Mink Beige/Charcoal/Amber Gold': { primary: '#D4C4B0', secondary: '#4a4a4a', tertiary: '#f4a900' },
        'Blue Teal/Birch/Navy': { primary: '#008B8B', secondary: '#F5F3EE', tertiary: '#001f3f' },
        'White/Columbia Blue/Yellow': { primary: '#ffffff', secondary: '#9bddff', tertiary: '#ffff00' },
        'Heather Grey/Red/Black': { primary: '#b3b3b3', secondary: '#dc3545', tertiary: '#000000' },
        'Heather Grey/Birch/Army Olive': { primary: '#b3b3b3', secondary: '#F5F3EE', tertiary: '#4B5320' },
        'Cream/Navy/Amber Gold': { primary: '#fff5e1', secondary: '#001f3f', tertiary: '#f4a900' },
        'Cream/Grey Brown/Brown': { primary: '#fff5e1', secondary: '#7C6A5C', tertiary: '#654321' },
        'Heather Grey/Birch/Amber Gold': { primary: '#b3b3b3', secondary: '#F5F3EE', tertiary: '#f4a900' },
        'Cream/Black/Loden': { primary: '#fff5e1', secondary: '#000000', tertiary: '#4a5f42' },
        'Black/White/Red': { primary: '#000000', secondary: '#ffffff', tertiary: '#dc3545' },
        'Columbia Blue/White/Navy': { primary: '#9bddff', secondary: '#ffffff', tertiary: '#001f3f' },
        'Royal/White/Red': { primary: '#4169e1', secondary: '#ffffff', tertiary: '#dc3545' },
        'Red/White/Navy': { primary: '#dc3545', secondary: '#ffffff', tertiary: '#001f3f' },
        'Grey/Charcoal/Black': { primary: '#d3d3d3', secondary: '#4a4a4a', tertiary: '#000000' },
        'Red/White/Black': { primary: '#dc3545', secondary: '#ffffff', tertiary: '#000000' },
        'Orange/White/Black': { primary: '#ff6b35', secondary: '#ffffff', tertiary: '#000000' },
        'Navy/White/Red': { primary: '#001f3f', secondary: '#ffffff', tertiary: '#dc3545' },
        'Black/White/Heather Grey': { primary: '#000000', secondary: '#ffffff', tertiary: '#b3b3b3' },
        'Navy/White/Heather Grey': { primary: '#001f3f', secondary: '#ffffff', tertiary: '#b3b3b3' },
        'Red/White/Heather Grey': { primary: '#dc3545', secondary: '#ffffff', tertiary: '#b3b3b3' },
        'Royal/White/Heather Grey': { primary: '#4169e1', secondary: '#ffffff', tertiary: '#b3b3b3' },
        'Grey/Charcoal/Navy': { primary: '#d3d3d3', secondary: '#4a4a4a', tertiary: '#001f3f' },
        'Heather Grey/Cardinal/Navy': { primary: '#b3b3b3', secondary: '#8B001A', tertiary: '#001f3f' },
        'Heather Grey/Charcoal/Dark Orange': { primary: '#b3b3b3', secondary: '#4a4a4a', tertiary: '#FF8C00' },
        'Heather Grey/Charcoal/Maroon': { primary: '#b3b3b3', secondary: '#4a4a4a', tertiary: '#800000' }
    };

    /**
     * Enhance a line item with color selection capability
     * @param {HTMLElement} lineItemElement - The line item to enhance
     */
    static enhanceLineItem(lineItemElement) {
        const styleInput = lineItemElement.querySelector('.style-input');
        if (!styleInput) return;

        console.log('[Color Selector] Enhancing line item');

        // Watch for when validation marks the input as valid
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (styleInput.classList.contains('valid')) {
                        const value = styleInput.value.trim().toUpperCase();
                        console.log('[Color Selector] Valid style detected:', value);
                        this.handleStyleChange(lineItemElement, value);
                    }
                }
            });
        });

        observer.observe(styleInput, {
            attributes: true,
            attributeFilter: ['class']
        });

        // Store observer so we can disconnect it later if needed
        lineItemElement._colorSelectorObserver = observer;

        // Also watch the autocomplete list for clicks
        setTimeout(() => {
            const autocompleteList = lineItemElement.querySelector('.autocomplete-list');
            if (autocompleteList) {
                console.log('[Color Selector] Autocomplete list found, attaching listener');
                autocompleteList.addEventListener('click', (e) => {
                    const item = e.target.closest('.autocomplete-item');
                    if (item) {
                        console.log('[Color Selector] Autocomplete item clicked');

                        // Get the style from the autocomplete item's dataset or text
                        const styleFromItem = item.querySelector('.autocomplete-style');
                        if (styleFromItem) {
                            const selectedStyle = styleFromItem.textContent.trim().toUpperCase();
                            console.log('[Color Selector] Style from autocomplete item:', selectedStyle);

                            // Trigger immediately with the clicked style (bypass validation)
                            setTimeout(() => {
                                console.log('[Color Selector] Triggering for style:', selectedStyle);
                                this.handleStyleChange(lineItemElement, selectedStyle);
                            }, 300);
                        }
                    }
                });
            } else {
                console.log('[Color Selector] Autocomplete list NOT found');
            }
        }, 100);
    }

    /**
     * Handle style selection change
     * @param {HTMLElement} lineItemElement - The line item element
     * @param {string} styleNumber - The selected style number
     */
    static handleStyleChange(lineItemElement, styleNumber) {
        console.log('[Color Selector] handleStyleChange called with:', styleNumber);

        // Check if style 112
        if (styleNumber.toUpperCase() === '112') {
            console.log('[Color Selector] Style 112 detected! Creating integrated component...');

            // COMPLETELY REPLACE the line item with the integrated Richardson component
            const colorSelector = this.createColorSelectorWithCircles();

            // Clear the line item and replace with integrated component
            lineItemElement.innerHTML = '';
            lineItemElement.appendChild(colorSelector);
            lineItemElement.classList.add('is-richardson-112');

            // Initialize functionality
            this.initializeColorSelector(colorSelector, lineItemElement);

            console.log('[Color Selector] Richardson 112 integrated component created');
        } else {
            // For non-112 styles, check if it was previously 112 and restore standard structure
            const existingIntegrated = lineItemElement.querySelector('.richardson-112-integrated');
            if (existingIntegrated || lineItemElement.classList.contains('is-richardson-112')) {
                console.log('[Color Selector] Removing 112 component for non-112 style');
                this.restoreStandardLineItem(lineItemElement, styleNumber);
            } else {
                // Just remove any old color selector
                const existingSelector = lineItemElement.querySelector('.color-selector-compact');
                if (existingSelector) {
                    existingSelector.remove();
                }
            }
        }
    }

    /**
     * Restore standard line item structure for non-112 styles
     * @param {HTMLElement} lineItemElement - The line item element
     * @param {string} styleNumber - The style number to restore
     */
    static restoreStandardLineItem(lineItemElement, styleNumber) {
        console.log('[Color Selector] Restoring standard line item for style:', styleNumber);

        lineItemElement.classList.remove('is-richardson-112');
        lineItemElement.innerHTML = `
            <div class="style-input-group">
                <label>Style Number</label>
                <div class="autocomplete-wrapper">
                    <input type="text"
                           class="form-input style-input"
                           value="${styleNumber}"
                           placeholder="Type style number..."
                           autocomplete="off">
                    <div class="autocomplete-list hidden"></div>
                    <span class="validation-indicator valid"></span>
                </div>
            </div>
            <div class="quantity-input-group">
                <label>Quantity</label>
                <input type="number"
                       class="form-input quantity-input"
                       placeholder="Enter quantity"
                       min="1">
            </div>
            <button type="button" class="remove-btn remove-style-btn" aria-label="Remove item">
                <i class="fas fa-times"></i>
                <span>Remove</span>
            </button>
        `;

        console.log('[Color Selector] Standard line item restored');
    }

    /**
     * Create the visual color selector with color circles
     * @returns {HTMLElement} The integrated Richardson 112 component
     */
    static createColorSelectorWithCircles() {
        const wrapper = document.createElement('div');
        wrapper.className = 'richardson-112-integrated';

        // Get all colors grouped by category
        const allColors = window.RICHARDSON_112_COLORS || [];
        const solidColors = allColors.filter(c => c.category === 'Solid');
        const splitColors = allColors.filter(c => c.category === 'Split');
        const triColors = allColors.filter(c => c.category === 'Tri-Color');
        const combColors = allColors.filter(c => c.category === 'Combination');

        // Default first solid color for initial image
        const defaultColor = solidColors[0] || allColors[0];

        wrapper.innerHTML = `
            <!-- Title Header -->
            <div class="richardson-title-section">
                <h3 class="richardson-title">Richardson 112 Trucker Hat</h3>
                <p class="richardson-subtitle">The gold standard of trucker hats.</p>
            </div>

            <!-- Simplified Layout: Preview + Selection -->
            <div class="richardson-112-layout">

                <!-- Cap Preview Image -->
                <div class="cap-preview-section">
                    <div class="cap-image-wrapper">
                        <img src="${defaultColor.url}"
                             alt="${defaultColor.color}"
                             class="preview-image">
                        <div class="image-loading-overlay" style="display: none;">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                    </div>
                </div>

                <!-- Color Selection Section -->
                <div class="color-selection-section">
                    <!-- Selected Color Display -->
                    <div class="selected-color-display">
                        <span class="color-label-text">Selected Color:</span>
                        <span class="color-current-name">${defaultColor.color}</span>
                    </div>

                    <!-- View All Colors Button (PRIMARY) -->
                    <button type="button" class="view-all-colors-btn">
                        <i class="fas fa-palette"></i>
                        View All ${allColors.length} Colors
                        <i class="fas fa-arrow-right"></i>
                    </button>

                    <!-- Style & Quantity Inputs -->
                    <div class="inputs-grid">
                        <div class="input-field">
                            <label>Style Number</label>
                            <input type="text" class="style-input style-input-readonly" value="112" readonly>
                        </div>
                        <div class="input-field">
                            <label>Quantity</label>
                            <input type="number" class="quantity-input" placeholder="E.g., 24" min="1">
                        </div>
                    </div>

                    <!-- Remove Button -->
                    <button type="button" class="remove-btn-full">
                        <i class="fas fa-trash-alt"></i>
                        Remove Item
                    </button>
                </div>

            </div>
        `;

        return wrapper;
    }

    /**
     * Generate color circles HTML
     * @param {Array} allColors - All available colors
     * @returns {string} HTML string of color circles
     */
    static generateColorCircles(allColors) {
        return allColors.map(colorItem => {
            const colorName = colorItem.color;
            const category = colorItem.category;

            // Get color hex or gradient
            const colorStyle = this.getColorStyle(colorName);

            return `
                <div class="color-circle"
                     data-color="${colorName}"
                     data-url="${colorItem.url}"
                     data-category="${category}"
                     data-tooltip="${colorName}"
                     style="${colorStyle}"
                     tabindex="0"
                     role="button"
                     aria-label="Select ${colorName}">
                </div>
            `;
        }).join('');
    }

    /**
     * Get CSS style for a color circle (solid, split, or tri-color gradient)
     * @param {string} colorName - Color name to get style for
     * @returns {string} CSS style string
     */
    static getColorStyle(colorName) {
        const colorData = this.COLOR_HEX_MAP[colorName];

        if (!colorData) {
            // Fallback to a gray circle if color not found
            return 'background-color: #cccccc;';
        }

        // Check if it's an object (split or tri-color)
        if (typeof colorData === 'object') {
            // Tri-color (has tertiary)
            if (colorData.tertiary) {
                return `background: linear-gradient(90deg, ${colorData.primary} 33.33%, ${colorData.secondary} 33.33%, ${colorData.secondary} 66.66%, ${colorData.tertiary} 66.66%);`;
            }
            // Split color (only primary and secondary)
            if (colorData.primary && colorData.secondary) {
                return `background: linear-gradient(90deg, ${colorData.primary} 50%, ${colorData.secondary} 50%);`;
            }
        }

        // Solid color
        return `background-color: ${colorData};`;
    }

    /**
     * Initialize color selector functionality
     * @param {HTMLElement} colorSelector - The integrated Richardson component
     * @param {HTMLElement} lineItemElement - The parent line item
     */
    static initializeColorSelector(colorSelector, lineItemElement) {
        const previewImage = colorSelector.querySelector('.preview-image');
        const loadingOverlay = colorSelector.querySelector('.image-loading-overlay');
        const currentColorLabel = colorSelector.querySelector('.color-current-name');
        const viewAllColorsBtn = colorSelector.querySelector('.view-all-colors-btn');
        const removeBtn = colorSelector.querySelector('.remove-btn-full');
        const quantityInput = colorSelector.querySelector('.quantity-input');

        console.log('[Color Selector] Initializing modal-first Richardson 112');

        // Handle image loading
        if (previewImage && loadingOverlay) {
            previewImage.addEventListener('load', () => {
                loadingOverlay.style.display = 'none';
            });

            previewImage.addEventListener('error', () => {
                loadingOverlay.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                console.error('[Color Selector] Image failed to load');
            });
        }

        // Handle "View All Colors" button - PRIMARY COLOR SELECTION
        if (viewAllColorsBtn) {
            viewAllColorsBtn.addEventListener('click', () => {
                console.log('[Color Selector] Opening color gallery modal');
                this.showColorGallery(colorSelector, lineItemElement);
            });

            // Add keyboard support
            viewAllColorsBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    viewAllColorsBtn.click();
                }
            });
        }

        // Handle remove button
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                if (confirm('Remove this Richardson 112 item?')) {
                    lineItemElement.remove();

                    // Update quote counter after removal
                    if (window.richardsonCalculator && window.richardsonCalculator.updateQuoteCounter) {
                        window.richardsonCalculator.updateQuoteCounter();
                    }

                    console.log('[Color Selector] Item removed');
                }
            });
        }

        // Handle quantity input changes
        if (quantityInput) {
            quantityInput.addEventListener('change', () => {
                const quantity = parseInt(quantityInput.value);
                if (quantity > 0) {
                    lineItemElement.dataset.quantity = quantity;
                    console.log('[Color Selector] Quantity updated:', quantity);

                    // Trigger quote counter update
                    if (window.richardsonCalculator && window.richardsonCalculator.updateQuoteCounter) {
                        window.richardsonCalculator.updateQuoteCounter();
                        console.log('[Color Selector] Quote counter updated');
                    }
                }
            });

            // Also listen for 'input' event for real-time updates
            quantityInput.addEventListener('input', () => {
                const quantity = parseInt(quantityInput.value);
                if (quantity > 0) {
                    lineItemElement.dataset.quantity = quantity;

                    // Trigger quote counter update
                    if (window.richardsonCalculator && window.richardsonCalculator.updateQuoteCounter) {
                        window.richardsonCalculator.updateQuoteCounter();
                    }
                }
            });
        }
    }

    /**
     * Filter color circles based on category
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {string} category - Category to filter ('All', 'Solid', 'Split', etc.)
     */
    static filterColorCircles(colorSelector, category) {
        const colorCircles = colorSelector.querySelectorAll('.color-circle');
        const countCurrent = colorSelector.querySelector('.count-current');
        const countTotal = colorSelector.querySelector('.count-total');

        let visibleCount = 0;

        colorCircles.forEach(circle => {
            const circleCategory = circle.dataset.category;

            if (category === 'All' || circleCategory === category) {
                circle.classList.remove('hidden');
                visibleCount++;
            } else {
                circle.classList.add('hidden');
            }
        });

        // Update count display
        if (countCurrent) countCurrent.textContent = visibleCount;
        if (countTotal && category === 'All') {
            countTotal.textContent = colorCircles.length;
        }

        console.log('[Color Selector] Filtered:', visibleCount, 'of', colorCircles.length, 'colors (category:', category + ')');
    }

    /**
     * Select a color and update UI
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {HTMLElement} lineItemElement - The line item element
     * @param {string} color - Color name
     * @param {string} imageUrl - Image URL
     * @param {string} category - Color category
     * @param {HTMLElement} clickedCircle - The circle that was clicked
     */
    static selectColor(colorSelector, lineItemElement, color, imageUrl, category, clickedCircle) {
        const previewImage = colorSelector.querySelector('.preview-image');
        const loadingOverlay = colorSelector.querySelector('.image-loading-overlay');
        const currentColorLabel = colorSelector.querySelector('.color-current-name');

        console.log('[Color Selector] Selecting color:', color);

        // Update preview image
        if (previewImage && loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            previewImage.src = imageUrl;
            previewImage.alt = color;
        }

        // Update the selected color label
        if (currentColorLabel) {
            currentColorLabel.textContent = color;
        }

        // Store color in line item data
        lineItemElement.dataset.selectedColor = color;

        console.log('[Color Selector] Color selected successfully:', color);
    }

    /**
     * Show color gallery modal with all options
     * @param {HTMLElement} colorSelector - The color selector to update when gallery item clicked
     * @param {HTMLElement} lineItemElement - The line item element
     */
    static showColorGallery(colorSelector, lineItemElement) {
        let galleryModal = document.getElementById('colorGalleryModal');
        if (!galleryModal) {
            galleryModal = this.createGalleryModal(colorSelector, lineItemElement);
            document.body.appendChild(galleryModal);
        } else {
            // Update click handlers for current color selector
            this.updateGalleryClickHandlers(galleryModal, colorSelector, lineItemElement);
        }

        // Update selected state in gallery
        const currentColor = lineItemElement.dataset.selectedColor;
        if (currentColor) {
            const galleryItems = galleryModal.querySelectorAll('.gallery-item');
            galleryItems.forEach(item => {
                if (item.dataset.color === currentColor) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        galleryModal.classList.add('active');
    }

    /**
     * Create color gallery modal
     * @param {HTMLElement} colorSelector - The color selector to update
     * @param {HTMLElement} lineItemElement - The line item element
     * @returns {HTMLElement} The gallery modal element
     */
    static createGalleryModal(colorSelector, lineItemElement) {
        const modal = document.createElement('div');
        modal.id = 'colorGalleryModal';
        modal.className = 'color-gallery-modal';

        // Group colors by category
        const categories = ['Solid', 'Split', 'Tri-Color', 'Combination'];
        const colorsByCategory = {};
        categories.forEach(cat => {
            colorsByCategory[cat] = window.RICHARDSON_112_COLORS.filter(c => c.category === cat);
        });

        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Richardson 112 - Color Gallery</h3>
                    <button type="button" class="modal-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <!-- Category Tabs -->
                    <div class="modal-category-tabs">
                        ${categories.map((cat, idx) => {
                            const count = colorsByCategory[cat].length;
                            if (count === 0) return '';
                            const icons = {
                                'Solid': 'fa-circle',
                                'Split': 'fa-adjust',
                                'Tri-Color': 'fa-palette',
                                'Combination': 'fa-swatchbook'
                            };
                            return `
                                <button type="button"
                                        class="modal-category-tab ${idx === 0 ? 'active' : ''}"
                                        data-category="${cat}">
                                    <i class="fas ${icons[cat]}"></i>
                                    ${cat} (${count})
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Gallery Grids (one per category) -->
                    ${categories.map((cat, idx) => {
                        const colors = colorsByCategory[cat];
                        if (colors.length === 0) return '';

                        return `
                            <div class="gallery-grid" data-category="${cat}" style="${idx === 0 ? '' : 'display:none;'}">
                                ${colors.map(colorItem => `
                                    <div class="gallery-item"
                                         data-color="${colorItem.color}"
                                         data-url="${colorItem.url}"
                                         data-category="${colorItem.category}">
                                        <div class="gallery-image-wrapper">
                                            <img src="${colorItem.url}"
                                                 alt="${colorItem.description}"
                                                 loading="lazy"
                                                 class="gallery-image">
                                            <div class="gallery-image-loading">
                                                <i class="fas fa-spinner fa-spin"></i>
                                            </div>
                                        </div>
                                        <div class="gallery-item-info">
                                            <span class="gallery-color-name">${colorItem.color}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Handle close
        const closeBtn = modal.querySelector('.modal-close-btn');
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        const backdrop = modal.querySelector('.modal-backdrop');
        backdrop.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Handle category tabs
        const categoryTabs = modal.querySelectorAll('.modal-category-tab');
        const galleryGrids = modal.querySelectorAll('.gallery-grid');

        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;

                // Update active tab
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show matching gallery
                galleryGrids.forEach(grid => {
                    if (grid.dataset.category === category) {
                        grid.style.display = 'grid';
                    } else {
                        grid.style.display = 'none';
                    }
                });
            });
        });

        // Set up gallery click handlers
        this.updateGalleryClickHandlers(modal, colorSelector, lineItemElement);

        // Handle image load states
        const images = modal.querySelectorAll('.gallery-image');
        images.forEach(img => {
            const wrapper = img.closest('.gallery-image-wrapper');
            const loading = wrapper.querySelector('.gallery-image-loading');

            img.addEventListener('load', () => {
                if (loading) loading.style.display = 'none';
            });

            img.addEventListener('error', () => {
                if (loading) {
                    loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                }
            });
        });

        return modal;
    }

    /**
     * Update gallery click handlers to work with current color selector
     * @param {HTMLElement} galleryModal - The gallery modal
     * @param {HTMLElement} colorSelector - The color selector to update
     * @param {HTMLElement} lineItemElement - The line item element
     */
    static updateGalleryClickHandlers(galleryModal, colorSelector, lineItemElement) {
        const galleryItems = galleryModal.querySelectorAll('.gallery-item');

        galleryItems.forEach(item => {
            // Remove old listeners by cloning
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            // Add new listener
            newItem.addEventListener('click', () => {
                const color = newItem.dataset.color;
                const imageUrl = newItem.dataset.url;
                const category = newItem.dataset.category;

                console.log('[Color Selector] Gallery item clicked:', color);

                // Find matching circle in selector
                const matchingCircle = colorSelector.querySelector(`.color-circle[data-color="${color}"]`);

                // Select the color
                this.selectColor(colorSelector, lineItemElement, color, imageUrl, category, matchingCircle);

                // Update gallery selection state
                const allGalleryItems = galleryModal.querySelectorAll('.gallery-item');
                allGalleryItems.forEach(gi => gi.classList.remove('selected'));
                newItem.classList.add('selected');

                // Close gallery after short delay
                setTimeout(() => {
                    galleryModal.classList.remove('active');
                }, 300);
            });
        });
    }

    /**
     * Get selected color for a line item
     * @param {HTMLElement} lineItemElement - The line item element
     * @returns {string|null} The selected color name or null
     */
    static getSelectedColor(lineItemElement) {
        return lineItemElement.dataset.selectedColor || null;
    }

    /**
     * Check if a line item has color data
     * @param {HTMLElement} lineItemElement - The line item element
     * @returns {boolean} True if line item is for style 112 and has color selector
     */
    static hasColorSelector(lineItemElement) {
        return lineItemElement.querySelector('.color-selector-compact') !== null;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.RichardsonColorSelector = RichardsonColorSelector;

    console.log('[Richardson Color Selector] Visual Color Circle Design loaded (2025)');
    console.log('[Richardson Color Selector] Available colors:',
                window.RICHARDSON_112_COLORS ? window.RICHARDSON_112_COLORS.length : 0);
}
