/**
 * Toast Notifications System
 * Modern, lightweight toast notifications for user feedback
 * Created: 2025-10-15
 *
 * Usage:
 *   ToastNotifications.success('Product added to quote');
 *   ToastNotifications.error('Failed to load product');
 *   ToastNotifications.info('Tip: Click product to edit');
 */

class ToastNotifications {
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'info', 'warning'
     * @param {number} duration - How long to show (milliseconds)
     */
    static show(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `nwca-toast nwca-toast-${type}`;

        // Choose icon based on type
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        toast.innerHTML = `
            <i class="fas fa-${icons[type] || 'info-circle'} nwca-toast-icon"></i>
            <span class="nwca-toast-message">${message}</span>
        `;

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
                // Clean up container if empty
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }, duration);
    }

    /**
     * Shorthand methods for common types
     */
    static success(message, duration = 3000) {
        this.show(message, 'success', duration);
    }

    static error(message, duration = 4000) {
        this.show(message, 'error', duration);
    }

    static warning(message, duration = 3500) {
        this.show(message, 'warning', duration);
    }

    static info(message, duration = 3000) {
        this.show(message, 'info', duration);
    }
}

// Make globally available
window.ToastNotifications = ToastNotifications;

console.log('[ToastNotifications] ✅ Toast notification system loaded');
