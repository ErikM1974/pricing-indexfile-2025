/**
 * Product Thumbnail Modal - Shared across all quote builders
 * Click thumbnail to see larger image with product details
 *
 * Usage:
 * 1. Include this script in your quote builder HTML
 * 2. Add thumbnail img elements with onclick="productThumbnailModal.open(...)"
 * 3. Modal will be created automatically on first use
 *
 * @version 1.0.0
 * @date 2026-01-29
 */

class ProductThumbnailModal {
    constructor() {
        this.modalElement = null;
        this.isOpen = false;
    }

    /**
     * Create the modal HTML structure if it doesn't exist
     */
    createModal() {
        if (document.getElementById('product-image-modal')) {
            this.modalElement = document.getElementById('product-image-modal');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'product-image-modal';
        modal.className = 'product-image-modal hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'modal-product-title');
        modal.innerHTML = `
            <div class="product-image-modal-backdrop" onclick="productThumbnailModal.close()"></div>
            <div class="product-image-modal-content">
                <button class="product-image-modal-close"
                        onclick="productThumbnailModal.close()"
                        aria-label="Close modal"
                        title="Close">&times;</button>
                <img id="modal-product-img"
                     class="product-image-modal-image"
                     src=""
                     alt="Product image"
                     onerror="this.style.display='none'">
                <div class="product-image-modal-details">
                    <h3 id="modal-product-title"></h3>
                    <p>Style: <span id="modal-product-style"></span></p>
                    <p>Color: <span id="modal-product-color"></span></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.modalElement = modal;

        // Add escape key listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Open the modal with product details
     * @param {string} imageUrl - URL to the product image
     * @param {string} title - Product title/name (optional, defaults to style)
     * @param {string} style - Style number (e.g., "PC54")
     * @param {string} color - Color name (e.g., "Brilliant Orange")
     */
    open(imageUrl, title, style, color) {
        // Create modal on first use
        if (!this.modalElement) {
            this.createModal();
        }

        const imgEl = document.getElementById('modal-product-img');
        const titleEl = document.getElementById('modal-product-title');
        const styleEl = document.getElementById('modal-product-style');
        const colorEl = document.getElementById('modal-product-color');

        // Set image - show element and set src
        imgEl.style.display = 'block';
        imgEl.src = imageUrl || '';
        imgEl.alt = title || style || 'Product image';

        // Set text content
        titleEl.textContent = title || style || 'Product';
        styleEl.textContent = style || '-';
        colorEl.textContent = color || '-';

        // Show modal
        this.modalElement.classList.remove('hidden');
        this.isOpen = true;

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Focus the close button for accessibility
        const closeBtn = this.modalElement.querySelector('.product-image-modal-close');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 100);
        }
    }

    /**
     * Close the modal
     */
    close() {
        if (this.modalElement) {
            this.modalElement.classList.add('hidden');
        }
        this.isOpen = false;
        document.body.style.overflow = '';
    }
}

// Create global instance
window.productThumbnailModal = new ProductThumbnailModal();

/**
 * Helper function to create a thumbnail element
 * Can be used when building table rows dynamically
 *
 * @param {Object} options - Thumbnail options
 * @param {string} options.imageUrl - Product image URL
 * @param {string} options.productName - Product name for alt text
 * @param {string} options.styleNumber - Style number
 * @param {string} options.colorName - Color name
 * @returns {string} HTML string for the thumbnail cell
 */
window.createProductThumbnailCell = function(options) {
    const { imageUrl, productName, styleNumber, colorName } = options;

    // Escape values for safe HTML insertion
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    const safeImageUrl = escapeHtml(imageUrl);
    const safeProductName = escapeHtml(productName);
    const safeStyleNumber = escapeHtml(styleNumber);
    const safeColorName = escapeHtml(colorName);

    if (imageUrl) {
        return `<td class="thumbnail-col">
            <img src="${safeImageUrl}"
                 alt="${safeProductName || safeStyleNumber}"
                 class="product-thumbnail"
                 onclick="productThumbnailModal.open('${safeImageUrl}', '${safeProductName}', '${safeStyleNumber}', '${safeColorName}')"
                 onerror="this.classList.add('no-image'); this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';">
        </td>`;
    } else {
        return `<td class="thumbnail-col">
            <div class="product-thumbnail no-image"
                 title="No image available"
                 style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;">
            </div>
        </td>`;
    }
};
