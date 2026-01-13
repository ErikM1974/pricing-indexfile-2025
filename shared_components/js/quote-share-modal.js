/**
 * Shared Quote Share Modal
 * Used by all quote builders for shareable URL functionality
 *
 * Usage:
 *   1. Include this script in your HTML
 *   2. Call QuoteShareModal.init() on page load
 *   3. Call QuoteShareModal.show(quoteId) after successful save
 *
 * @example
 *   // In your saveAndGetLink() function:
 *   const result = await quoteService.saveQuote(quoteData);
 *   if (result.success) {
 *       QuoteShareModal.show(result.quoteId);
 *   }
 */
const QuoteShareModal = {
    /**
     * Initialize the modal - injects HTML and binds events
     * Safe to call multiple times (idempotent)
     */
    init() {
        if (document.getElementById('quote-share-modal')) {
            return; // Already initialized
        }
        document.body.insertAdjacentHTML('beforeend', this.getModalHTML());
        this.bindEvents();
    },

    /**
     * Get the modal HTML structure
     * Uses namespaced classes to avoid CSS conflicts
     */
    getModalHTML() {
        return `
        <div id="quote-share-modal" class="quote-share-modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="quote-share-title">
            <div class="quote-share-modal-content">
                <div class="quote-share-modal-header">
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    <h3 id="quote-share-title">Quote Saved!</h3>
                </div>
                <div class="quote-share-modal-body">
                    <p>Quote ID: <strong id="quote-share-modal-id">---</strong></p>
                    <p id="quote-share-instructions">Share this link with your customer:</p>
                    <div class="quote-share-url-container">
                        <input type="text" id="quote-share-url" class="quote-share-url-input" readonly aria-label="Shareable quote URL" aria-describedby="quote-share-instructions">
                        <button class="quote-share-btn-copy" id="quote-share-copy-btn" aria-label="Copy URL to clipboard">
                            <i class="fas fa-copy" aria-hidden="true"></i> Copy
                        </button>
                    </div>
                </div>
                <div class="quote-share-modal-footer">
                    <button class="quote-share-btn-view" id="quote-share-view-btn" aria-label="Open quote in new tab">
                        <i class="fas fa-external-link-alt" aria-hidden="true"></i> View Quote
                    </button>
                    <button class="quote-share-btn-close" id="quote-share-close-btn" aria-label="Close dialog">
                        Close
                    </button>
                </div>
            </div>
        </div>`;
    },

    /**
     * Bind event handlers to modal buttons
     */
    bindEvents() {
        const copyBtn = document.getElementById('quote-share-copy-btn');
        const viewBtn = document.getElementById('quote-share-view-btn');
        const closeBtn = document.getElementById('quote-share-close-btn');
        const overlay = document.getElementById('quote-share-modal');

        if (copyBtn) copyBtn.onclick = () => this.copyUrl();
        if (viewBtn) viewBtn.onclick = () => this.viewQuote();
        if (closeBtn) closeBtn.onclick = () => this.close();

        // Close on backdrop click
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target.id === 'quote-share-modal') this.close();
            };
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
                this.close();
            }
        });
    },

    /**
     * Show the modal with the saved quote ID
     * @param {string} quoteId - The quote ID (e.g., "DTF0113-1234")
     * @param {string} [baseUrl] - Optional custom base URL (defaults to current origin)
     */
    show(quoteId, baseUrl) {
        this.init(); // Ensure modal exists

        const origin = baseUrl || window.location.origin;
        const url = `${origin}/quote/${quoteId}`;

        document.getElementById('quote-share-modal-id').textContent = quoteId;
        document.getElementById('quote-share-url').value = url;
        document.getElementById('quote-share-modal').style.display = 'flex';

        // Reset copy button state
        const copyBtn = document.getElementById('quote-share-copy-btn');
        if (copyBtn) {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyBtn.classList.remove('copied');
        }
    },

    /**
     * Close the modal with exit animation
     */
    close() {
        const modal = document.getElementById('quote-share-modal');
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.remove('closing');
            }, 200);
        }
    },

    /**
     * Copy the URL to clipboard with visual feedback
     */
    copyUrl() {
        const urlInput = document.getElementById('quote-share-url');
        const copyBtn = document.getElementById('quote-share-copy-btn');

        if (!urlInput || !copyBtn) return;

        // Select and copy
        urlInput.select();
        urlInput.setSelectionRange(0, 99999); // For mobile

        // Try modern clipboard API first, fall back to execCommand
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(urlInput.value).then(() => {
                this.showCopySuccess(copyBtn);
            }).catch(() => {
                // Fallback
                document.execCommand('copy');
                this.showCopySuccess(copyBtn);
            });
        } else {
            document.execCommand('copy');
            this.showCopySuccess(copyBtn);
        }
    },

    /**
     * Show copy success visual feedback
     * @param {HTMLElement} btn - The copy button element
     */
    showCopySuccess(btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('copied');
        }, 2000);
    },

    /**
     * Open the quote view in a new tab
     */
    viewQuote() {
        const urlInput = document.getElementById('quote-share-url');
        if (urlInput && urlInput.value) {
            window.open(urlInput.value, '_blank');
        }
    }
};

// Auto-initialize when DOM is ready (optional - builders can call init() manually)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => QuoteShareModal.init());
} else {
    // DOM already loaded
    QuoteShareModal.init();
}
