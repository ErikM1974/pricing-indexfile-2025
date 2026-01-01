/* =====================================================
   STAFF DASHBOARD ANNOUNCEMENTS
   Priority-based announcement display system
   Training/Process updates with visual prominence
   ===================================================== */

const StaffDashboardAnnouncements = (function() {
    'use strict';

    // Configuration
    const CONFIG = {
        storageKey: 'staffDashboard_dismissedAnnouncements',
        priorityTypes: {
            urgent: { label: 'Urgent', icon: 'fa-exclamation-circle', class: 'urgent' },
            training: { label: 'Training', icon: 'fa-graduation-cap', class: 'training' },
            process: { label: 'Process Update', icon: 'fa-cogs', class: 'process' },
            general: { label: 'Announcement', icon: 'fa-bullhorn', class: 'general' }
        }
    };

    // State
    let announcements = [];
    let dismissedIds = new Set();

    // =====================================================
    // STORAGE FUNCTIONS
    // =====================================================

    /**
     * Load dismissed announcement IDs from localStorage
     */
    function loadDismissed() {
        try {
            const stored = localStorage.getItem(CONFIG.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                // Clean up old dismissals (older than 30 days)
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const valid = data.filter(d => d.timestamp > thirtyDaysAgo);
                dismissedIds = new Set(valid.map(d => d.id));
                // Save cleaned list
                saveDismissed();
            }
        } catch (e) {
            console.warn('Failed to load dismissed announcements:', e);
            dismissedIds = new Set();
        }
    }

    /**
     * Save dismissed announcement IDs to localStorage
     */
    function saveDismissed() {
        try {
            const data = Array.from(dismissedIds).map(id => ({
                id,
                timestamp: Date.now()
            }));
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save dismissed announcements:', e);
        }
    }

    // =====================================================
    // ANNOUNCEMENT FUNCTIONS
    // =====================================================

    /**
     * Set announcements data
     */
    function setAnnouncements(data) {
        announcements = data || [];
        loadDismissed();
    }

    /**
     * Get announcements filtered by dismissed status
     */
    function getActiveAnnouncements() {
        return announcements.filter(a => !dismissedIds.has(a.id));
    }

    /**
     * Get priority announcement (first non-dismissed)
     */
    function getPriorityAnnouncement() {
        const active = getActiveAnnouncements();
        // Sort by priority: urgent > training > process > general
        const priorityOrder = ['urgent', 'training', 'process', 'general'];
        active.sort((a, b) => {
            const aIndex = priorityOrder.indexOf(a.type || 'general');
            const bIndex = priorityOrder.indexOf(b.type || 'general');
            return aIndex - bIndex;
        });
        return active[0] || null;
    }

    /**
     * Dismiss an announcement
     */
    function dismissAnnouncement(id) {
        dismissedIds.add(id);
        saveDismissed();
    }

    /**
     * Reset dismissed announcements (show all again)
     */
    function resetDismissed() {
        dismissedIds.clear();
        saveDismissed();
    }

    // =====================================================
    // RENDER FUNCTIONS
    // =====================================================

    /**
     * Render the priority announcement hero
     */
    function renderAnnouncementHero(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const announcement = getPriorityAnnouncement();

        if (!announcement) {
            container.classList.add('empty');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('empty');
        const typeConfig = CONFIG.priorityTypes[announcement.type] || CONFIG.priorityTypes.general;

        container.innerHTML = `
            <div class="announcement-priority-badge ${typeConfig.class}">
                <i class="fas ${typeConfig.icon}"></i>
                <span>${typeConfig.label}</span>
            </div>
            <div class="announcement-icon">
                <i class="fas ${typeConfig.icon}"></i>
            </div>
            <div class="announcement-content">
                <div class="announcement-title">${escapeHtml(announcement.title)}</div>
                <div class="announcement-preview">${escapeHtml(announcement.preview || announcement.content || '')}</div>
            </div>
            <div class="announcement-controls">
                <button class="btn-dismiss" onclick="StaffDashboardAnnouncements.dismiss('${announcement.id}')">
                    <i class="fas fa-check"></i> Got it
                </button>
                <button class="btn-view-all" onclick="StaffDashboardAnnouncements.toggleList()">
                    View All <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `;
    }

    /**
     * Render the full announcements list
     */
    function renderAnnouncementsList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const active = getActiveAnnouncements();

        if (active.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="empty-state-title">All caught up!</div>
                    <div class="empty-state-message">No new announcements to show.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = active.map(announcement => {
            const typeConfig = CONFIG.priorityTypes[announcement.type] || CONFIG.priorityTypes.general;
            return `
                <div class="announcement-item" data-id="${announcement.id}">
                    <span class="announcement-item-badge ${typeConfig.class}">${typeConfig.label}</span>
                    <div class="announcement-item-content">
                        <div class="announcement-item-title">${escapeHtml(announcement.title)}</div>
                        <div class="announcement-item-date">${formatDate(announcement.date)}</div>
                    </div>
                    <button class="btn-dismiss-small" onclick="StaffDashboardAnnouncements.dismiss('${announcement.id}')" title="Dismiss">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    /**
     * Toggle announcements list visibility
     */
    function toggleList() {
        const list = document.getElementById('announcementsList');
        if (list) {
            list.classList.toggle('expanded');
        }
    }

    /**
     * Dismiss and re-render
     */
    function dismiss(id) {
        dismissAnnouncement(id);
        renderAnnouncementHero('announcementsHero');
        renderAnnouncementsList('announcementsList');
    }

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format date for display
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    return {
        // Data management
        setAnnouncements,
        getActiveAnnouncements,
        getPriorityAnnouncement,
        dismissAnnouncement,
        resetDismissed,

        // Rendering
        renderAnnouncementHero,
        renderAnnouncementsList,

        // Actions
        dismiss,
        toggleList,

        // Config
        CONFIG
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.StaffDashboardAnnouncements = StaffDashboardAnnouncements;
}
