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
        'Navy/Neon Green': { primary: '#001f3f', secondary: '#39ff14' }
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

        console.log('[Color Selector] Style 112 detected! Creating visual color selector...');

        // Insert color selector after quantity input
        const quantityGroup = lineItemElement.querySelector('.quantity-input-group');
        if (!quantityGroup) {
            console.error('[Color Selector] Quantity group not found!');
            return;
        }

        const colorSelector = this.createColorSelectorWithCircles();
        quantityGroup.insertAdjacentElement('afterend', colorSelector);

        console.log('[Color Selector] Color circle selector inserted into DOM');

        // Initialize color selection functionality
        this.initializeColorSelector(colorSelector, lineItemElement);

        console.log('[Color Selector] Color selector initialized');
    }

    /**
     * Create the visual color selector with color circles
     * @returns {HTMLElement} The color selector wrapper element
     */
    static createColorSelectorWithCircles() {
        const wrapper = document.createElement('div');
        wrapper.className = 'color-selector-compact';
        wrapper.dataset.activeCategory = 'All'; // Default to showing all colors

        // Get all colors grouped by category
        const allColors = window.RICHARDSON_112_COLORS || [];
        const solidColors = allColors.filter(c => c.category === 'Solid');
        const splitColors = allColors.filter(c => c.category === 'Split');
        const triColors = allColors.filter(c => c.category === 'Tri-Color');
        const combColors = allColors.filter(c => c.category === 'Combination');

        // Default first solid color for initial image
        const defaultColor = solidColors[0] || allColors[0];

        wrapper.innerHTML = `
            <!-- LEFT COLUMN: Large Cap Image -->
            <div class="color-preview-large">
                <img src="${defaultColor.url}"
                     alt="${defaultColor.color}"
                     class="preview-image">
                <div class="image-loading-overlay" style="display: none;">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading...</span>
                </div>
            </div>

            <!-- RIGHT COLUMN: Color Controls -->
            <div class="color-controls-column">
                <!-- Category Pills -->
                <div class="category-filter-section">
                    <div class="category-filter-label">Filter by Category:</div>
                    <div class="category-filter-tabs">
                        <button type="button" class="category-tab active" data-category="All">
                            <i class="fas fa-th"></i>
                            All
                        </button>
                        ${solidColors.length > 0 ? `
                        <button type="button" class="category-tab" data-category="Solid">
                            <i class="fas fa-circle"></i>
                            Solid
                        </button>
                        ` : ''}
                        ${splitColors.length > 0 ? `
                        <button type="button" class="category-tab" data-category="Split">
                            <i class="fas fa-adjust"></i>
                            Split
                        </button>
                        ` : ''}
                        ${triColors.length > 0 ? `
                        <button type="button" class="category-tab" data-category="Tri-Color">
                            <i class="fas fa-palette"></i>
                            Tri
                        </button>
                        ` : ''}
                        ${combColors.length > 0 ? `
                        <button type="button" class="category-tab" data-category="Combination">
                            <i class="fas fa-swatchbook"></i>
                            Combo
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Color Circles Grid -->
                <div class="quick-colors-section">
                    <div class="quick-colors-header">
                        <span class="quick-colors-label">Select Color:</span>
                        <a href="#" class="view-all-link">
                            <i class="fas fa-th"></i>
                            View All
                        </a>
                    </div>
                    <div class="quick-colors-grid">
                        ${this.generateColorCircles(allColors)}
                    </div>
                </div>
            </div>

            <!-- Selected Color Banner (Spans Both Columns) -->
            <div class="selected-color-banner hidden">
                <i class="fas fa-check-circle selected-color-icon"></i>
                <span class="selected-color-label">Selected:</span>
                <span class="selected-color-name"></span>
                <button type="button" class="clear-color-btn" title="Clear selection">
                    <i class="fas fa-times"></i> Clear
                </button>
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
     * Get CSS style for a color circle (solid or gradient)
     * @param {string} colorName - Color name to get style for
     * @returns {string} CSS style string
     */
    static getColorStyle(colorName) {
        const colorData = this.COLOR_HEX_MAP[colorName];

        if (!colorData) {
            // Fallback to a gray circle if color not found
            return 'background-color: #cccccc;';
        }

        // Check if it's a split color (object with primary/secondary)
        if (typeof colorData === 'object' && colorData.primary && colorData.secondary) {
            // Use CSS gradient for split colors
            return `background: linear-gradient(90deg, ${colorData.primary} 50%, ${colorData.secondary} 50%);`;
        }

        // Solid color
        return `background-color: ${colorData};`;
    }

    /**
     * Initialize color selector functionality
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {HTMLElement} lineItemElement - The parent line item
     */
    static initializeColorSelector(colorSelector, lineItemElement) {
        const previewImage = colorSelector.querySelector('.preview-image');
        const loadingOverlay = colorSelector.querySelector('.image-loading-overlay');
        const selectedBanner = colorSelector.querySelector('.selected-color-banner');
        const selectedName = colorSelector.querySelector('.selected-color-name');
        const clearBtn = colorSelector.querySelector('.clear-color-btn');
        const viewAllLink = colorSelector.querySelector('.view-all-link');
        const categoryTabs = colorSelector.querySelectorAll('.category-tab');
        const colorCircles = colorSelector.querySelectorAll('.color-circle');

        // Handle image loading
        if (previewImage && loadingOverlay) {
            previewImage.addEventListener('load', () => {
                loadingOverlay.style.display = 'none';
            });

            previewImage.addEventListener('error', () => {
                loadingOverlay.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Image failed to load</span>';
            });
        }

        // Handle category filter tabs (show/hide circles)
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;

                // Update active tab
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update wrapper data attribute
                colorSelector.dataset.activeCategory = category;

                // Filter color circles (show/hide based on category)
                this.filterColorCircles(colorSelector, category);

                console.log('[Color Selector] Category filter changed to:', category);
            });
        });

        // Handle color circle clicks
        colorCircles.forEach(circle => {
            // Click handler
            circle.addEventListener('click', () => {
                const color = circle.dataset.color;
                const imageUrl = circle.dataset.url;
                const category = circle.dataset.category;

                this.selectColor(colorSelector, lineItemElement, color, imageUrl, category, circle);
            });

            // Keyboard navigation (Enter or Space)
            circle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    circle.click();
                }
            });
        });

        // Handle clear selection
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                selectedBanner.classList.add('hidden');
                delete lineItemElement.dataset.selectedColor;

                // Remove selection from circles
                colorCircles.forEach(c => c.classList.remove('selected'));

                // Reset to default image
                const allColors = window.RICHARDSON_112_COLORS || [];
                const defaultColor = allColors.find(c => c.category === 'Solid') || allColors[0];
                if (defaultColor && previewImage) {
                    loadingOverlay.style.display = 'flex';
                    previewImage.src = defaultColor.url;
                    previewImage.alt = defaultColor.color;
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
     * Filter color circles based on category
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {string} category - Category to filter ('All', 'Solid', 'Split', etc.)
     */
    static filterColorCircles(colorSelector, category) {
        const colorCircles = colorSelector.querySelectorAll('.color-circle');

        colorCircles.forEach(circle => {
            const circleCategory = circle.dataset.category;

            if (category === 'All' || circleCategory === category) {
                circle.classList.remove('hidden');
            } else {
                circle.classList.add('hidden');
            }
        });
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
        const selectedBanner = colorSelector.querySelector('.selected-color-banner');
        const selectedName = colorSelector.querySelector('.selected-color-name');
        const colorCircles = colorSelector.querySelectorAll('.color-circle');

        console.log('[Color Selector] Selecting color:', color);

        // Update preview image
        if (previewImage && loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            previewImage.src = imageUrl;
            previewImage.alt = color;
        }

        // Show selected banner
        selectedBanner.classList.remove('hidden');
        selectedName.textContent = color;

        // Store color in line item data
        lineItemElement.dataset.selectedColor = color;

        // Update circle states (remove all selected, add to clicked)
        colorCircles.forEach(c => c.classList.remove('selected'));
        if (clickedCircle) {
            clickedCircle.classList.add('selected');
        }

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
