/**
 * Toast Notifications System
 * Modern, lightweight toast notifications for user feedback
 * Created: 2025-10-15 · Hardened 2026-09-05:
 *   - the message is set with textContent (it used to go through innerHTML, so a server
 *     error string could have become markup — the alert() calls it now replaces were safe);
 *   - the module styles itself (no stylesheet anywhere defined .nwca-toast, so every toast
 *     rendered as bare text at the bottom of the page);
 *   - errors stay up longer (they replace blocking alert() dialogs on the detail pages).
 *
 * Usage:
 *   ToastNotifications.success('Product added to quote');
 *   ToastNotifications.error('Failed to load product');
 *   ToastNotifications.info('Tip: Click product to edit');
 */
class ToastNotifications {
    static ensureStyles() {
        if (document.getElementById('nwca-toast-styles')) return;
        // (2026-09-06) styles live in /shared_components/css/toast-notifications.css — linked by every consumer page, nothing injected.
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display (plain text — never interpreted as HTML)
     * @param {string} type - Type: 'success', 'error', 'info', 'warning'
     * @param {number} duration - How long to show (milliseconds)
     */
    static show(message, type = 'success', duration = 3000) {
        this.ensureStyles();
        const toast = document.createElement('div');
        toast.className = `nwca-toast nwca-toast-${type}`;
        toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        const icon = document.createElement('i');
        icon.className = `fas fa-${icons[type] || 'info-circle'} nwca-toast-icon`;
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.className = 'nwca-toast-message';
        text.textContent = String(message == null ? '' : message);
        toast.appendChild(icon);
        toast.appendChild(text);

        // Add to container (create if doesn't exist)
        let container = document.getElementById('nwca-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'nwca-toast-container';
            container.classList.add('nwca-toast-container');
            document.body.appendChild(container);
        }
        container.appendChild(toast);

        // Trigger slide-in animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }, duration);
    }

    /**
     * Shorthand methods for common types
     */
    static success(message, duration = 3500) {
        this.show(message, 'success', duration);
    }

    static error(message, duration = 8000) {
        this.show(message, 'error', duration);
    }

    static warning(message, duration = 6000) {
        this.show(message, 'warning', duration);
    }

    static info(message, duration = 5000) {
        this.show(message, 'info', duration);
    }
}

// Make globally available
window.ToastNotifications = ToastNotifications;
