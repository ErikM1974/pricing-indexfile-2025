/**
 * Sidebar Resize Functionality
 * Allows users to drag the sidebar edge to resize it
 * Saves preference to localStorage for persistence
 *
 * @version 2026-01-14
 */

class SidebarResizer {
    constructor(sidebarSelector = '#power-sidebar', handleSelector = '#sidebar-resize-handle') {
        this.sidebar = document.querySelector(sidebarSelector);
        this.handle = document.querySelector(handleSelector);
        this.isResizing = false;
        this.minWidth = 260;
        this.maxWidth = 500;
        this.storageKey = 'sidebarWidth';

        if (this.sidebar && this.handle) {
            this.init();
        }
    }

    init() {
        // Mouse events
        this.handle.addEventListener('mousedown', (e) => this.startResize(e));
        document.addEventListener('mousemove', (e) => this.resize(e));
        document.addEventListener('mouseup', () => this.stopResize());

        // Touch events for mobile/tablet
        this.handle.addEventListener('touchstart', (e) => this.startResize(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.resizeTouch(e), { passive: false });
        document.addEventListener('touchend', () => this.stopResize());

        // Load saved width from localStorage
        this.loadSavedWidth();

        // Double-click to reset to default
        this.handle.addEventListener('dblclick', () => this.resetWidth());
    }

    loadSavedWidth() {
        const savedWidth = localStorage.getItem(this.storageKey);
        if (savedWidth) {
            const width = parseInt(savedWidth, 10);
            if (width >= this.minWidth && width <= this.maxWidth) {
                this.sidebar.style.width = width + 'px';
            }
        }
    }

    startResize(e) {
        this.isResizing = true;
        this.handle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }

    resize(e) {
        if (!this.isResizing) return;

        const containerRect = this.sidebar.parentElement.getBoundingClientRect();
        const newWidth = containerRect.right - e.clientX;

        this.applyWidth(newWidth);
    }

    resizeTouch(e) {
        if (!this.isResizing) return;
        if (e.touches.length === 0) return;

        const touch = e.touches[0];
        const containerRect = this.sidebar.parentElement.getBoundingClientRect();
        const newWidth = containerRect.right - touch.clientX;

        this.applyWidth(newWidth);
        e.preventDefault();
    }

    applyWidth(newWidth) {
        if (newWidth >= this.minWidth && newWidth <= this.maxWidth) {
            this.sidebar.style.width = newWidth + 'px';
        }
    }

    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
            this.handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Save width to localStorage
            const currentWidth = parseInt(this.sidebar.style.width, 10);
            if (!isNaN(currentWidth)) {
                localStorage.setItem(this.storageKey, currentWidth);
            }
        }
    }

    resetWidth() {
        // Reset to default width (300px)
        this.sidebar.style.width = '300px';
        localStorage.removeItem(this.storageKey);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if the resize handle exists
    if (document.querySelector('#sidebar-resize-handle')) {
        window.sidebarResizer = new SidebarResizer();
    }
});
