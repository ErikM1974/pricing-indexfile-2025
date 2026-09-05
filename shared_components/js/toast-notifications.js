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
        const style = document.createElement('style');
        style.id = 'nwca-toast-styles';
        style.textContent = [
            '#nwca-toast-container{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:min(92vw,640px)}',
            '.nwca-toast{display:flex;align-items:flex-start;gap:10px;padding:12px 18px;border-radius:8px;background:#1f2937;color:#fff;font:14px/1.4 Inter,-apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;pointer-events:auto;white-space:pre-line;word-break:break-word}',
            '.nwca-toast.show{opacity:1;transform:translateY(0)}',
            '.nwca-toast-success{background:#14532d}.nwca-toast-error{background:#991b1b}.nwca-toast-warning{background:#92400e}.nwca-toast-info{background:#1e3a5f}',
            '.nwca-toast-icon{margin-top:2px;flex:none}',
        ].join('');
        document.head.appendChild(style);
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
