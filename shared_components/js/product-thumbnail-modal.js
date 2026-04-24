/**
 * Product Thumbnail Modal - Shared across quote builders + supacolor-job-detail
 * Click thumbnail to see larger image with product details
 *
 * Two entry points:
 * 1. open(imageUrl, title, style, color) — legacy quote-builder API (Style/Color labels)
 * 2. openGeneric({imageUrl, title, metaLines, downloadUrl, downloadFilename}) — flexible
 *    meta-line layout + optional Download button. Used by supacolor-job-detail.
 *
 * CSS: shared_components/css/product-thumbnail-modal.css (standalone) OR
 *      quote-builder-common.css (duplicate rules, same selectors).
 *
 * @version 2.0.0
 * @date 2026-04-24 (added openGeneric + download, refactored to data-close delegation)
 */

class ProductThumbnailModal {
    constructor() {
        this.modalElement = null;
        this.isOpen = false;
    }

    /**
     * Escape a string for safe HTML insertion.
     */
    _escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Create the modal HTML structure if it doesn't exist.
     *
     * The details block is split into two mutually-exclusive regions:
     *   #modal-product-legacy-details — shown by open() (Style:/Color: layout)
     *   #modal-product-meta           — shown by openGeneric() (custom label/value lines)
     * Only one is visible at a time. This keeps existing quote-builder callers
     * working unchanged while adding flexibility for Supacolor and other pages.
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
            <div class="product-image-modal-backdrop" data-close="true"></div>
            <div class="product-image-modal-content">
                <button class="product-image-modal-close"
                        data-close="true"
                        aria-label="Close modal"
                        title="Close">&times;</button>
                <img id="modal-product-img"
                     class="product-image-modal-image"
                     src=""
                     alt="Product image"
                     onerror="this.style.display='none'">
                <div class="product-image-modal-details">
                    <h3 id="modal-product-title"></h3>
                    <div id="modal-product-legacy-details">
                        <p>Style: <span id="modal-product-style"></span></p>
                        <p>Color: <span id="modal-product-color"></span></p>
                    </div>
                    <div id="modal-product-meta" style="display:none;"></div>
                </div>
                <div id="modal-product-actions" class="product-image-modal-actions" style="display:none;">
                    <a id="modal-product-download"
                       class="product-image-modal-download"
                       target="_blank"
                       rel="noopener"><i class="fas fa-download"></i> Download</a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.modalElement = modal;

        // Delegated close handling (replaces old inline onclick="...")
        // — survives cases where window.productThumbnailModal was reassigned or renamed.
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) {
                this.close();
            }
        });

        // Escape key listener (attach once per instance)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Open the modal with product details (LEGACY — quote-builder API).
     * Shows the Style:/Color: layout. Unchanged behavior from v1.
     *
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
        const legacyEl = document.getElementById('modal-product-legacy-details');
        const metaEl = document.getElementById('modal-product-meta');
        const actionsEl = document.getElementById('modal-product-actions');

        // Set image - show element and set src
        imgEl.style.display = 'block';
        imgEl.src = imageUrl || '';
        imgEl.alt = title || style || 'Product image';

        // Set text content
        titleEl.textContent = title || style || 'Product';
        styleEl.textContent = style || '-';
        colorEl.textContent = color || '-';

        // Show legacy layout, hide generic meta + actions
        if (legacyEl) legacyEl.style.display = '';
        if (metaEl) metaEl.style.display = 'none';
        if (actionsEl) actionsEl.style.display = 'none';

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
     * Open the modal with a flexible meta-line layout + optional download button.
     * Used by supacolor-job-detail and other non-quote-builder pages where the
     * "Style:" / "Color:" labels don't semantically fit.
     *
     * @param {Object} opts
     * @param {string} opts.imageUrl - URL to the image
     * @param {string} [opts.title] - Modal heading
     * @param {Array<{label:string, value:string}>} [opts.metaLines] - Label/value pairs rendered under the title
     * @param {string} [opts.downloadUrl] - If set, shows a Download button linking here
     * @param {string} [opts.downloadFilename] - Filename for the download (defaults to 'image.jpg')
     *
     * Example:
     *   productThumbnailModal.openGeneric({
     *     imageUrl: 'https://supacolor.cdn/xyz.jpg',
     *     title: 'Washington Rock Quarries - 13.5"',
     *     metaLines: [
     *       { label: 'Item Code', value: 'WE319816' },
     *       { label: 'Detail', value: 'Mixed color fabric 13.5" Width | WE_A3' }
     *     ],
     *     downloadUrl: 'https://supacolor.cdn/xyz.jpg',
     *     downloadFilename: 'WE319816-transfer.jpg'
     *   });
     */
    openGeneric(opts) {
        opts = opts || {};
        if (!this.modalElement) this.createModal();

        const imgEl = document.getElementById('modal-product-img');
        const titleEl = document.getElementById('modal-product-title');
        const legacyEl = document.getElementById('modal-product-legacy-details');
        const metaEl = document.getElementById('modal-product-meta');
        const actionsEl = document.getElementById('modal-product-actions');
        const dlEl = document.getElementById('modal-product-download');

        // Image
        imgEl.style.display = 'block';
        imgEl.src = opts.imageUrl || '';
        imgEl.alt = opts.title || 'Image';

        // Title
        titleEl.textContent = opts.title || '';

        // Meta lines (hide legacy Style/Color, show generic list)
        if (legacyEl) legacyEl.style.display = 'none';
        if (metaEl) {
            metaEl.style.display = '';
            const metaLines = Array.isArray(opts.metaLines) ? opts.metaLines : [];
            metaEl.innerHTML = metaLines
                .filter(m => m && m.value != null && m.value !== '')
                .map(m =>
                    '<p><span class="meta-label">' + this._escapeHtml(m.label) + ':</span> ' +
                    this._escapeHtml(m.value) + '</p>'
                ).join('');
        }

        // Download button (optional)
        if (opts.downloadUrl && actionsEl && dlEl) {
            actionsEl.style.display = '';
            dlEl.href = opts.downloadUrl; // fallback for browsers where the onclick fails
            dlEl.onclick = (e) => this.downloadImage(e, opts.downloadUrl, opts.downloadFilename);
        } else if (actionsEl) {
            actionsEl.style.display = 'none';
        }

        // Show modal
        this.modalElement.classList.remove('hidden');
        this.isOpen = true;
        document.body.style.overflow = 'hidden';

        const closeBtn = this.modalElement.querySelector('.product-image-modal-close');
        if (closeBtn) setTimeout(() => closeBtn.focus(), 100);
    }

    /**
     * Download an image via fetch → blob → <a download>. Falls back to
     * window.open() when the fetch fails (usually CORS on a cross-origin CDN
     * that doesn't send Access-Control-Allow-Origin). In the fallback case
     * the image opens in a new tab and the user can right-click → Save As.
     */
    async downloadImage(event, url, filename) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (!url) return;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const blob = await resp.blob();
            const objUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objUrl;
            a.download = filename || 'image.jpg';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(objUrl);
                a.remove();
            }, 100);
        } catch (err) {
            // Most commonly CORS — fall back to opening the image in a new tab.
            console.warn('[ProductThumbnailModal] Direct download failed, opening in new tab:', err);
            window.open(url, '_blank', 'noopener');
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
