/**
 * Richardson Color Selector Enhancement - Compact Design (2025)
 * Modern, professional, contained color selector for Richardson 112 caps
 *
 * USAGE:
 * 1. Include richardson-112-images.js before this file
 * 2. Call RichardsonColorSelector.enhanceLineItem(lineItemElement) after creating a line item
 * 3. When style 112 is selected, compact color selector appears
 */

class RichardsonColorSelector {
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

        // Remove existing color selector if present
        const existingSelector = lineItemElement.querySelector('.color-selector-compact');
        if (existingSelector) {
            console.log('[Color Selector] Removing existing selector');
            existingSelector.remove();
        }

        // Only add color selector for style 112
        if (styleNumber.toUpperCase() !== '112') {
            console.log('[Color Selector] Not style 112, skipping');
            return;
        }

        console.log('[Color Selector] Style 112 detected! Creating compact color selector...');

        // Insert color selector after quantity input
        const quantityGroup = lineItemElement.querySelector('.quantity-input-group');
        if (!quantityGroup) {
            console.error('[Color Selector] Quantity group not found!');
            return;
        }

        const colorSelector = this.createCompactColorSelector();
        quantityGroup.insertAdjacentElement('afterend', colorSelector);

        console.log('[Color Selector] Compact color selector inserted into DOM');

        // Initialize color selection functionality
        this.initializeColorSelector(colorSelector, lineItemElement);

        console.log('[Color Selector] Color selector initialized');
    }

    /**
     * Create the compact color selector HTML structure
     * @returns {HTMLElement} The color selector wrapper element
     */
    static createCompactColorSelector() {
        const wrapper = document.createElement('div');
        wrapper.className = 'color-selector-compact';

        // Get all colors grouped by category
        const solidColors = window.RICHARDSON_112_COLORS.filter(c => c.category === 'Solid');
        const splitColors = window.RICHARDSON_112_COLORS.filter(c => c.category === 'Split');
        const triColors = window.RICHARDSON_112_COLORS.filter(c => c.category === 'Tri-Color');
        const combColors = window.RICHARDSON_112_COLORS.filter(c => c.category === 'Combination');

        // Default first solid color
        const defaultColor = solidColors[0];

        // Popular colors for quick select (most common orders)
        const quickColors = [
            { name: 'Black', category: 'Solid' },
            { name: 'Navy', category: 'Solid' },
            { name: 'Charcoal', category: 'Solid' },
            { name: 'White', category: 'Solid' },
            { name: 'Red', category: 'Solid' }
        ];

        wrapper.innerHTML = `
            <!-- Color Selection Row: Dropdown + Preview -->
            <div class="color-selection-row">
                <div class="color-dropdown-wrapper">
                    <select class="color-dropdown">
                        <option value="">Select a color...</option>
                        <optgroup label="🔴 Solid Colors (${solidColors.length})">
                            ${solidColors.map(c => `<option value="${c.color}" data-url="${c.url}" data-category="Solid">${c.color}</option>`).join('')}
                        </optgroup>
                        <optgroup label="◐ Split Colors (${splitColors.length})">
                            ${splitColors.map(c => `<option value="${c.color}" data-url="${c.url}" data-category="Split">${c.color}</option>`).join('')}
                        </optgroup>
                        ${triColors.length > 0 ? `
                        <optgroup label="🎨 Tri-Color (${triColors.length})">
                            ${triColors.map(c => `<option value="${c.color}" data-url="${c.url}" data-category="Tri-Color">${c.color}</option>`).join('')}
                        </optgroup>
                        ` : ''}
                        ${combColors.length > 0 ? `
                        <optgroup label="🔷 Combination (${combColors.length})">
                            ${combColors.map(c => `<option value="${c.color}" data-url="${c.url}" data-category="Combination">${c.color}</option>`).join('')}
                        </optgroup>
                        ` : ''}
                    </select>
                </div>

                <div class="color-preview-thumbnail">
                    <img src="${defaultColor.url}"
                         alt="${defaultColor.color}"
                         class="thumbnail-image">
                </div>
            </div>

            <!-- Quick Color Selection -->
            <div class="quick-colors-section">
                <div class="quick-colors-header">
                    <span class="quick-colors-label">Quick Select:</span>
                    <a href="#" class="view-all-link">
                        <i class="fas fa-th"></i>
                        View All
                    </a>
                </div>
                <div class="quick-colors-grid">
                    ${quickColors.map(qc => {
                        const colorData = window.RICHARDSON_112_COLORS.find(
                            c => c.color === qc.name && c.category === qc.category
                        );
                        if (!colorData) return '';
                        return `
                            <button type="button"
                                    class="quick-color-btn"
                                    data-color="${colorData.color}"
                                    data-url="${colorData.url}"
                                    data-category="${colorData.category}">
                                <i class="fas fa-circle"></i>
                                ${colorData.color}
                            </button>
                        `;
                    }).join('')}
                    ${splitColors.length > 0 ? `
                        <button type="button"
                                class="quick-color-btn"
                                data-color="${splitColors[0].color}"
                                data-url="${splitColors[0].url}"
                                data-category="Split">
                            <i class="fas fa-adjust"></i>
                            ${splitColors[0].color}
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Selected Color Display -->
            <div class="selected-color-display hidden">
                <i class="fas fa-check-circle selected-color-icon"></i>
                <span class="selected-color-label">Selected:</span>
                <span class="selected-color-name"></span>
                <button type="button" class="clear-color-btn" title="Clear selection">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        return wrapper;
    }

    /**
     * Initialize color selector functionality
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {HTMLElement} lineItemElement - The parent line item
     */
    static initializeColorSelector(colorSelector, lineItemElement) {
        const dropdown = colorSelector.querySelector('.color-dropdown');
        const thumbnail = colorSelector.querySelector('.thumbnail-image');
        const selectedDisplay = colorSelector.querySelector('.selected-color-display');
        const selectedName = colorSelector.querySelector('.selected-color-name');
        const clearBtn = colorSelector.querySelector('.clear-color-btn');
        const viewAllLink = colorSelector.querySelector('.view-all-link');
        const quickColorBtns = colorSelector.querySelectorAll('.quick-color-btn');

        // Handle dropdown selection
        dropdown.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (!selectedOption.value) return;

            const color = selectedOption.value;
            const imageUrl = selectedOption.dataset.url;
            const category = selectedOption.dataset.category;

            this.selectColor(colorSelector, lineItemElement, color, imageUrl, category);
        });

        // Handle quick color buttons
        quickColorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                const imageUrl = btn.dataset.url;
                const category = btn.dataset.category;

                // Update dropdown to match
                dropdown.value = color;

                this.selectColor(colorSelector, lineItemElement, color, imageUrl, category);
            });
        });

        // Handle clear selection
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                dropdown.value = '';
                selectedDisplay.classList.add('hidden');
                delete lineItemElement.dataset.selectedColor;

                // Remove selection from quick buttons
                quickColorBtns.forEach(btn => btn.classList.remove('selected'));

                // Reset to default image
                const defaultColor = window.RICHARDSON_112_COLORS.find(c => c.category === 'Solid');
                if (defaultColor && thumbnail) {
                    thumbnail.src = defaultColor.url;
                    thumbnail.alt = defaultColor.color;
                }

                console.log('[Color Selector] Selection cleared');
            });
        }

        // Handle view all link
        if (viewAllLink) {
            viewAllLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showColorGallery(colorSelector, lineItemElement);
            });
        }
    }

    /**
     * Select a color and update UI
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {HTMLElement} lineItemElement - The line item element
     * @param {string} color - Color name
     * @param {string} imageUrl - Image URL
     * @param {string} category - Color category
     */
    static selectColor(colorSelector, lineItemElement, color, imageUrl, category) {
        const thumbnail = colorSelector.querySelector('.thumbnail-image');
        const selectedDisplay = colorSelector.querySelector('.selected-color-display');
        const selectedName = colorSelector.querySelector('.selected-color-name');
        const quickColorBtns = colorSelector.querySelectorAll('.quick-color-btn');

        console.log('[Color Selector] Selecting color:', color);

        // Update thumbnail image
        if (thumbnail) {
            thumbnail.src = imageUrl;
            thumbnail.alt = color;
        }

        // Show selected color
        selectedDisplay.classList.remove('hidden');
        selectedName.textContent = color;

        // Store color in line item data
        lineItemElement.dataset.selectedColor = color;

        // Update quick button states
        quickColorBtns.forEach(btn => {
            if (btn.dataset.color === color) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        console.log('[Color Selector] Color selected successfully');
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
                    <h3>Richardson 112 - All Colors</h3>
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

                // Update dropdown
                const dropdown = colorSelector.querySelector('.color-dropdown');
                if (dropdown) {
                    dropdown.value = color;
                }

                // Select the color
                this.selectColor(colorSelector, lineItemElement, color, imageUrl, category);

                // Update gallery selection state
                galleryItems.forEach(gi => gi.classList.remove('selected'));
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

    console.log('[Richardson Color Selector] Compact enhancement loaded (2025)');
    console.log('[Richardson Color Selector] Available colors:',
                window.RICHARDSON_112_COLORS ? window.RICHARDSON_112_COLORS.length : 0);
}
