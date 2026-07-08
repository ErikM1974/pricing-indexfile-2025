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
                    <p>Quote ID: <strong id="quote-share-modal-id">---</strong> <span id="quote-share-note" class="quote-share-note" style="display:none;"></span></p>
                    <p id="quote-share-instructions">Share this link with your customer:</p>
                    <div class="quote-share-url-container">
                        <input type="text" id="quote-share-url" class="quote-share-url-input" readonly aria-label="Shareable quote URL" aria-describedby="quote-share-instructions">
                        <button class="quote-share-btn-copy" id="quote-share-copy-btn" aria-label="Copy URL to clipboard">
                            <i class="fas fa-copy" aria-hidden="true"></i> Copy
                        </button>
                    </div>
                </div>
                <div class="quote-share-modal-footer">
                    <button class="quote-share-btn-email" id="quote-share-email-btn" aria-label="Email this quote to the customer">
                        <i class="fas fa-envelope" aria-hidden="true"></i> Email to customer
                    </button>
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
        const emailBtn = document.getElementById('quote-share-email-btn');
        const overlay = document.getElementById('quote-share-modal');

        if (copyBtn) copyBtn.onclick = () => this.copyUrl();
        if (viewBtn) viewBtn.onclick = () => this.viewQuote();
        if (closeBtn) closeBtn.onclick = () => this.close();
        if (emailBtn) emailBtn.onclick = () => this.emailToCustomer();

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
     * @param {string} quoteId - The quote ID (e.g., "DTF-2026-001")
     * @param {string|object} [opts] - Optional. A string is treated as a status
     *   note ("Updated to Rev 2") unless it starts with http(s), in which case it
     *   is a base URL (legacy). An object accepts { baseUrl, note, customerEmail,
     *   customerName, salesRepEmail } — the customer fields feed the Email button.
     *
     *   Back-compat note (2026-07-07): SCP/DTF historically passed "Updated to Rev
     *   N" into what this method used as baseUrl, so every UPDATE-save rendered a
     *   broken shareable URL ("Updated to Rev 2/quote/SP-…"). Strings are now
     *   sniffed and shown as the note they were always meant to be.
     */
    show(quoteId, opts) {
        this.init(); // Ensure modal exists

        let baseUrl = null;
        let note = null;
        this._customerEmail = null;
        this._customerName = null;
        this._salesRepEmail = null;
        if (typeof opts === 'string' && opts) {
            if (/^https?:\/\//i.test(opts)) baseUrl = opts;
            else note = opts;
        } else if (opts && typeof opts === 'object') {
            baseUrl = opts.baseUrl || null;
            note = opts.note || null;
            this._customerEmail = opts.customerEmail || null;
            this._customerName = opts.customerName || null;
            this._salesRepEmail = opts.salesRepEmail || null;
        }

        const origin = baseUrl || window.location.origin;
        const url = `${origin}/quote/${quoteId}`;

        document.getElementById('quote-share-modal-id').textContent = quoteId;
        document.getElementById('quote-share-url').value = url;
        const noteEl = document.getElementById('quote-share-note');
        if (noteEl) {
            noteEl.textContent = note || '';
            noteEl.style.display = note ? '' : 'none';
        }
        document.getElementById('quote-share-modal').style.display = 'flex';

        // Reset button states
        const copyBtn = document.getElementById('quote-share-copy-btn');
        if (copyBtn) {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyBtn.classList.remove('copied');
        }
        const emailBtn = document.getElementById('quote-share-email-btn');
        if (emailBtn) {
            emailBtn.disabled = false;
            emailBtn.innerHTML = '<i class="fas fa-envelope"></i> Email to customer';
            // Only offer Email when the shared helper is loaded and an address is reachable
            const hasEmail = !!(this._customerEmail || document.getElementById('customer-email')?.value?.trim());
            emailBtn.style.display = (typeof emailQuote === 'function' && hasEmail) ? '' : 'none';
        }
    },

    /**
     * Email the just-saved quote straight from the share modal (expert audit
     * 2026-07-07): "in the customer's inbox" is the end state of nearly every
     * phone quote, but it took Save → Copy → Close → find the Email button.
     * Reads the shared field ids every builder uses when no override was passed.
     */
    async emailToCustomer() {
        const btn = document.getElementById('quote-share-email-btn');
        const quoteId = document.getElementById('quote-share-modal-id')?.textContent;
        if (!quoteId || quoteId === '---' || typeof emailQuote !== 'function') return;
        const customerEmail = this._customerEmail || document.getElementById('customer-email')?.value?.trim();
        const customerName = this._customerName || document.getElementById('customer-name')?.value?.trim();
        const salesRepEmail = this._salesRepEmail || document.getElementById('sales-rep')?.value;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }
        let ok = false;
        try {
            ok = await emailQuote({ quoteId, customerEmail, customerName, salesRepEmail });
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = ok
                    ? '<i class="fas fa-check"></i> Emailed!'
                    : '<i class="fas fa-envelope"></i> Email to customer';
                if (ok) setTimeout(() => { btn.innerHTML = '<i class="fas fa-envelope"></i> Email to customer'; }, 2500);
            }
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
