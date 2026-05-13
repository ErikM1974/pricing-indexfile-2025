/* =====================================================
   STAFF DASHBOARD v3 — <dashboard-modal> custom element
   Single component owns: scroll-lock, focus-trap, escape-to-close,
   backdrop-click-to-close, ARIA dialog semantics.

   Replaces duplicated logic in staff-directory + gap-report modals.

   Markup:
     <dashboard-modal id="myModal" labelled-by="myTitle">
       <div slot="header">
         <h2 id="myTitle">Title</h2>
         <button class="dashboard-modal__close" data-modal-close aria-label="Close">&times;</button>
       </div>
       <div slot="body">…content…</div>
     </dashboard-modal>

   Open/close:
     document.getElementById('myModal').open();
     document.getElementById('myModal').close();

   Events:
     'dashboard-modal:open'  — fires after open transition starts
     'dashboard-modal:close' — fires after close transition starts
   ===================================================== */

const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

class DashboardModal extends HTMLElement {
    static observedAttributes = ['open'];

    constructor() {
        super();
        this._previousFocus = null;
        this._handleKeydown = this._handleKeydown.bind(this);
        this._handleBackdropClick = this._handleBackdropClick.bind(this);
        this._handleCloseClick = this._handleCloseClick.bind(this);
    }

    connectedCallback() {
        // Set ARIA attributes
        this.setAttribute('role', 'dialog');
        this.setAttribute('aria-modal', 'true');
        if (this.hasAttribute('labelled-by')) {
            this.setAttribute('aria-labelledby', this.getAttribute('labelled-by'));
        }

        // Click handlers
        this.addEventListener('click', this._handleBackdropClick);
        this.addEventListener('click', this._handleCloseClick);

        // Initial state
        if (!this.hasAttribute('open')) {
            this.style.display = 'none';
        }
    }

    disconnectedCallback() {
        this.removeEventListener('click', this._handleBackdropClick);
        this.removeEventListener('click', this._handleCloseClick);
        document.removeEventListener('keydown', this._handleKeydown);
        this._unlockScroll();
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (name !== 'open') return;
        const isOpen = newVal !== null;
        if (isOpen) this._onOpen();
        else        this._onClose();
    }

    /**
     * Open the modal.
     */
    open() {
        if (this.hasAttribute('open')) return;
        this.setAttribute('open', '');
    }

    /**
     * Close the modal.
     */
    close() {
        if (!this.hasAttribute('open')) return;
        this.removeAttribute('open');
    }

    _onOpen() {
        this.style.display = '';
        this._previousFocus = document.activeElement;
        this._lockScroll();
        document.addEventListener('keydown', this._handleKeydown);
        // Focus first focusable element after the next paint
        requestAnimationFrame(() => {
            const first = this._getFocusables()[0];
            if (first) first.focus();
            else this.focus();
        });
        this.dispatchEvent(new CustomEvent('dashboard-modal:open', { bubbles: true }));
    }

    _onClose() {
        document.removeEventListener('keydown', this._handleKeydown);
        this._unlockScroll();
        // Restore focus to the previously focused element
        if (this._previousFocus && typeof this._previousFocus.focus === 'function') {
            this._previousFocus.focus();
        }
        this._previousFocus = null;
        // Defer hide so close transitions can play
        setTimeout(() => {
            if (!this.hasAttribute('open')) this.style.display = 'none';
        }, 200);
        this.dispatchEvent(new CustomEvent('dashboard-modal:close', { bubbles: true }));
    }

    _handleKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            return;
        }
        if (e.key === 'Tab') {
            // Focus trap
            const focusables = this._getFocusables();
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    _handleBackdropClick(e) {
        // Click directly on the host (the backdrop), not on its children
        if (e.target === this) {
            this.close();
        }
    }

    _handleCloseClick(e) {
        const closer = e.target.closest('[data-modal-close]');
        if (closer && this.contains(closer)) {
            e.preventDefault();
            this.close();
        }
    }

    _getFocusables() {
        return Array.from(this.querySelectorAll(FOCUSABLE)).filter((el) => {
            return el.offsetParent !== null && !el.hasAttribute('inert');
        });
    }

    _lockScroll() {
        // Avoid layout shift from scrollbar disappearing
        const sw = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty('--scrollbar-width', sw + 'px');
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = sw + 'px';
    }
    _unlockScroll() {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.documentElement.style.removeProperty('--scrollbar-width');
    }
}

customElements.define('dashboard-modal', DashboardModal);

export { DashboardModal };
