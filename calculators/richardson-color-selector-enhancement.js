/**
 * Richardson Color Selector Enhancement
 * Adds color selection with image preview for Richardson 112 caps
 *
 * USAGE:
 * 1. Include richardson-112-images.js before this file
 * 2. Call RichardsonColorSelector.enhanceLineItem(lineItemElement) after creating a line item
 * 3. When style 112 is selected, color selector appears with image gallery
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
        const existingSelector = lineItemElement.querySelector('.color-selector-wrapper');
        if (existingSelector) {
            console.log('[Color Selector] Removing existing selector');
            existingSelector.remove();
        }

        // Only add color selector for style 112
        if (styleNumber.toUpperCase() !== '112') {
            console.log('[Color Selector] Not style 112, skipping');
            return;
        }

        console.log('[Color Selector] Style 112 detected! Creating color selector...');

        // Insert color selector after quantity input
        const quantityGroup = lineItemElement.querySelector('.quantity-input-group');
        if (!quantityGroup) {
            console.error('[Color Selector] Quantity group not found!');
            return;
        }

        const colorSelector = this.createColorSelector();
        quantityGroup.insertAdjacentElement('afterend', colorSelector);

        console.log('[Color Selector] Color selector inserted into DOM');

        // Initialize color selection functionality
        this.initializeColorSelector(colorSelector, lineItemElement);

        console.log('[Color Selector] Color selector initialized');
    }

    /**
     * Create the color selector HTML structure with catalog-style layout
     * @returns {HTMLElement} The color selector wrapper element
     */
    static createColorSelector() {
        const wrapper = document.createElement('div');
        wrapper.className = 'color-selector-wrapper';
        wrapper.dataset.activeCategory = 'Solid'; // Default to Solid category

        // Get default image (first solid color - Amber Gold)
        const defaultColor = window.RICHARDSON_112_COLORS.find(c => c.category === 'Solid');
        const defaultImageUrl = defaultColor ? defaultColor.url : '';
        const defaultColorName = defaultColor ? defaultColor.color : 'Amber Gold';

        wrapper.innerHTML = `
            <!-- LEFT COLUMN: Image Preview -->
            <div class="color-image-preview">
                <div class="preview-image-container">
                    <img src="${defaultImageUrl}"
                         alt="Richardson 112 - ${defaultColorName}"
                         class="color-preview-image">
                    <div class="image-loading-overlay">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading image...</span>
                    </div>
                </div>
                <div class="image-caption">
                    <i class="fas fa-info-circle"></i>
                    Click a color to see the cap
                </div>
            </div>

            <!-- RIGHT COLUMN: Color Options -->
            <div class="color-options-column">
                <div class="color-selector-header">
                    <label class="form-label">
                        <i class="fas fa-palette"></i>
                        Select Color
                    </label>
                    <button type="button" class="view-all-colors-btn">
                        <i class="fas fa-th"></i>
                        View All Colors
                    </button>
                </div>

                <!-- Category Tabs -->
                <div class="category-tabs">
                    <button type="button" class="category-tab active" data-category="Solid">
                        <i class="fas fa-circle"></i>
                        Solid
                    </button>
                    <button type="button" class="category-tab" data-category="Split">
                        <i class="fas fa-adjust"></i>
                        Split
                    </button>
                    <button type="button" class="category-tab" data-category="Tri-Color">
                        <i class="fas fa-palette"></i>
                        Tri-Color
                    </button>
                    <button type="button" class="category-tab" data-category="Combination">
                        <i class="fas fa-swatchbook"></i>
                        Combination
                    </button>
                </div>

                <!-- Color Grid (will be populated by active category) -->
                <div class="color-grid">
                    ${this.renderColorOptions('Solid')}
                </div>

                <div class="selected-color-display hidden">
                    <span class="selected-color-label">Selected:</span>
                    <span class="selected-color-name"></span>
                    <button type="button" class="clear-color-btn" title="Clear selection">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        return wrapper;
    }

    /**
     * Render color option buttons for a specific category
     * @param {string} category - Category to filter ('Solid' or 'Split')
     * @returns {string} HTML string of color options
     */
    static renderColorOptions(category = 'Solid') {
        if (!window.RICHARDSON_112_COLORS) {
            return '<div class="error">Color data not loaded</div>';
        }

        // Filter colors by category
        const filteredColors = window.RICHARDSON_112_COLORS.filter(
            colorItem => colorItem.category === category
        );

        if (filteredColors.length === 0) {
            return '<div class="error">No colors found for this category</div>';
        }

        return filteredColors.map(colorItem => `
            <button type="button"
                    class="color-option"
                    data-color="${colorItem.color}"
                    data-category="${colorItem.category}"
                    data-image-url="${colorItem.url}"
                    title="${colorItem.color} - Click to preview">
                <span class="color-name">${colorItem.color}</span>
                <i class="fas fa-check color-check"></i>
            </button>
        `).join('');
    }

    /**
     * Initialize color selector functionality
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {HTMLElement} lineItemElement - The parent line item
     */
    static initializeColorSelector(colorSelector, lineItemElement) {
        const selectedDisplay = colorSelector.querySelector('.selected-color-display');
        const selectedName = colorSelector.querySelector('.selected-color-name');
        const clearBtn = colorSelector.querySelector('.clear-color-btn');
        const viewAllBtn = colorSelector.querySelector('.view-all-colors-btn');
        const previewImage = colorSelector.querySelector('.color-preview-image');
        const loadingOverlay = colorSelector.querySelector('.image-loading-overlay');
        const colorGrid = colorSelector.querySelector('.color-grid');
        const categoryTabs = colorSelector.querySelectorAll('.category-tab');

        // Handle image loading states
        if (previewImage && loadingOverlay) {
            // Show loading initially
            loadingOverlay.style.display = 'flex';

            previewImage.addEventListener('load', () => {
                loadingOverlay.style.display = 'none';
            });

            previewImage.addEventListener('error', () => {
                loadingOverlay.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Image failed to load</span>';
            });
        }

        // Handle category tab switching
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;

                console.log('[Color Selector] Switching to category:', category);

                // Update active tab
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update wrapper data attribute
                colorSelector.dataset.activeCategory = category;

                // Re-render color grid with new category
                colorGrid.innerHTML = this.renderColorOptions(category);

                // Re-attach click listeners to new buttons
                this.attachColorOptionListeners(colorSelector, lineItemElement);

                // Update image to first color of new category
                const firstColor = window.RICHARDSON_112_COLORS.find(c => c.category === category);
                if (firstColor) {
                    this.updateInlineImage(colorSelector, firstColor.url, firstColor.color);
                }

                // Clear selection display
                selectedDisplay.classList.add('hidden');
                delete lineItemElement.dataset.selectedColor;
            });
        });

        // Attach color option listeners for initial render
        this.attachColorOptionListeners(colorSelector, lineItemElement);

        // Handle clear selection
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const colorOptions = colorSelector.querySelectorAll('.color-option');
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                selectedDisplay.classList.add('hidden');
                delete lineItemElement.dataset.selectedColor;

                // Reset to default image of current category
                const activeCategory = colorSelector.dataset.activeCategory || 'Solid';
                const defaultColor = window.RICHARDSON_112_COLORS.find(c => c.category === activeCategory);
                if (defaultColor) {
                    this.updateInlineImage(colorSelector, defaultColor.url, defaultColor.color);
                }
            });
        }

        // Handle view all colors - opens gallery modal
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this.showColorGallery(colorSelector, lineItemElement);
            });
        }
    }

    /**
     * Attach click listeners to color option buttons
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {HTMLElement} lineItemElement - The parent line item
     */
    static attachColorOptionListeners(colorSelector, lineItemElement) {
        const colorOptions = colorSelector.querySelectorAll('.color-option');
        const selectedDisplay = colorSelector.querySelector('.selected-color-display');
        const selectedName = colorSelector.querySelector('.selected-color-name');

        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const color = option.dataset.color;
                const imageUrl = option.dataset.imageUrl;

                console.log('[Color Selector] Color clicked:', color);

                // Update selection state
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                // Show selected color
                selectedDisplay.classList.remove('hidden');
                selectedName.textContent = color;

                // Store color in line item data
                lineItemElement.dataset.selectedColor = color;

                // Update inline image (catalog style - no modal)
                this.updateInlineImage(colorSelector, imageUrl, color);
            });
        });
    }

    /**
     * Update the inline image preview (catalog style)
     * @param {HTMLElement} colorSelector - The color selector element
     * @param {string} imageUrl - The image URL to display
     * @param {string} colorName - The color name
     */
    static updateInlineImage(colorSelector, imageUrl, colorName) {
        const previewImage = colorSelector.querySelector('.color-preview-image');
        const loadingOverlay = colorSelector.querySelector('.image-loading-overlay');

        if (!previewImage || !loadingOverlay) {
            console.error('[Color Selector] Preview image elements not found');
            return;
        }

        console.log('[Color Selector] Updating inline image to:', colorName);

        // Show loading overlay
        loadingOverlay.style.display = 'flex';

        // Update image
        previewImage.alt = `Richardson 112 - ${colorName}`;
        previewImage.src = imageUrl;

        // Loading overlay will hide automatically via the load event listener
    }

    /**
     * Show image preview modal
     * @param {string} imageUrl - The image URL to display
     * @param {string} colorName - The color name
     */
    static showImagePreview(imageUrl, colorName) {
        // Create or get existing modal
        let modal = document.getElementById('colorPreviewModal');
        if (!modal) {
            modal = this.createImageModal();
            document.body.appendChild(modal);
        }

        // Update modal content
        const modalImage = modal.querySelector('.preview-image');
        const modalTitle = modal.querySelector('.preview-title');

        if (modalImage && modalTitle) {
            modalImage.src = imageUrl;
            modalImage.alt = `Richardson 112 - ${colorName}`;
            modalTitle.textContent = `Richardson 112 - ${colorName}`;
        }

        // Show modal
        modal.classList.add('active');
    }

    /**
     * Create image preview modal
     * @returns {HTMLElement} The modal element
     */
    static createImageModal() {
        const modal = document.createElement('div');
        modal.id = 'colorPreviewModal';
        modal.className = 'color-preview-modal';

        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="preview-title">Richardson 112</h3>
                    <button type="button" class="modal-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <img src="" alt="Cap Preview" class="preview-image">
                    <div class="loading-indicator">
                        <i class="fas fa-spinner fa-spin"></i>
                        Loading image...
                    </div>
                </div>
            </div>
        `;

        // Handle close button
        const closeBtn = modal.querySelector('.modal-close-btn');
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Handle backdrop click
        const backdrop = modal.querySelector('.modal-backdrop');
        backdrop.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Handle image load
        const image = modal.querySelector('.preview-image');
        const loadingIndicator = modal.querySelector('.loading-indicator');

        image.addEventListener('load', () => {
            loadingIndicator.style.display = 'none';
        });

        image.addEventListener('error', () => {
            loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Image failed to load';
        });

        return modal;
    }

    /**
     * Show color gallery with all options
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

        const galleryItems = window.RICHARDSON_112_COLORS.map(colorItem => `
            <div class="gallery-item" data-color="${colorItem.color}" data-url="${colorItem.url}">
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
        `).join('');

        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content gallery-content">
                <div class="modal-header">
                    <h3>Richardson 112 - All Colors</h3>
                    <button type="button" class="modal-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="gallery-grid">
                        ${galleryItems}
                    </div>
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

                console.log('[Color Selector] Gallery item clicked:', color);

                // Close gallery
                galleryModal.classList.remove('active');

                // Update inline image
                this.updateInlineImage(colorSelector, imageUrl, color);

                // Update color selection in the color grid
                const colorOptions = colorSelector.querySelectorAll('.color-option');
                colorOptions.forEach(opt => {
                    if (opt.dataset.color === color) {
                        opt.click(); // This will handle selection state and storage
                    }
                });
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
        return lineItemElement.querySelector('.color-selector-wrapper') !== null;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.RichardsonColorSelector = RichardsonColorSelector;

    console.log('[Richardson Color Selector] Enhancement loaded');
    console.log('[Richardson Color Selector] Available colors:',
                window.RICHARDSON_112_COLORS ? window.RICHARDSON_112_COLORS.length : 0);
}
